const express = require('express');
const OpenAI = require('openai');
const MongoClient = require('mongodb').MongoClient;
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const app = express();
const porta = 3000;
const path = require('path');
require('dotenv').config()

const MongoStore = require('connect-mongo');

app.use('/img', express.static(path.join(__dirname, 'views', 'img')));
app.use('/style', express.static(path.join(__dirname, 'views', 'style')));

const urlMongo = "mongodb+srv://EcoMind:ecomindprojetofiap@ecomind.3ioosra.mongodb.net/?retryWrites=true&w=majority&appName=EcoMind";
const nomeBanco = 'EcoMind';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'arrozEfeijao',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: urlMongo,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

function protegerRota(req, res, proximo) {
    if (req.session.email) {
        proximo();
    } else {
        res.redirect('/login');
    }
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/home.html');
});

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/views/registrar.html');
});

app.post('/register', async (req, res) => {
    const cliente = new MongoClient(urlMongo);
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');

        const usuarioExistente = await colecaoUsuarios.findOne({ email: req.body.email });
        if (usuarioExistente) {
            res.send('Email ja cadastrado, tente novamente <br> <a href="/register" class="btn btn-primary">voltar</a>');
        } else {
            const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);
            await colecaoUsuarios.insertOne({
                nome: req.body.nome,
                email: req.body.email,
                empresa: req.body.empresa,
                senha: senhaCriptografada
            });
            res.redirect('/login');
        }
    } catch (erro) {
        console.error(erro);
        res.send('Erro ao registrar o usuário.');
    } finally {
        cliente.close();
    }
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

app.get('/dashboard', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo);

    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');

        const usuario = await colecaoUsuarios.findOne({ email: req.session.email });

        let html = fs.readFileSync(__dirname + '/views/dashboard.html', 'utf8');
        html = html.replace(/{{NOME_USUARIO}}/g, usuario?.nome || '');
        html = html.replace(/{{EMAIL_USUARIO}}/g, usuario?.empresa || '');
        res.send(html);

    } catch (err) {
        console.error(err);
        res.send("Erro ao carregar dashboard.");
    } finally {
        await cliente.close();
    }
});

app.post('/login', async (req, res) => {
    const cliente = new MongoClient(urlMongo);
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');

        const usuario = await colecaoUsuarios.findOne({ email: req.body.email });

        if (usuario && await bcrypt.compare(req.body.senha, usuario.senha)) {
            req.session.email = usuario.email;
            res.redirect('/dashboard');
        } else {
            res.redirect('/erro');
        }
    } catch (erro) {
        console.error(erro);
        res.send('Erro ao realizar login.');
    } finally {
        cliente.close();
    }
});

app.get('/formulario', protegerRota, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'formulario.html'));
});

app.post('/formulario', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo);
    
    try {
        const dadosFormulario = {
            funcionarios: req.body.funcionarios,
            setor: req.body.setor,
            controleEnergia: req.body.controleEnergia,
            praticasEnergia: req.body.praticasEnergia,
            controleAgua: req.body.controleAgua,
            destinacaoResiduos: req.body.destinacaoResiduos,
            compensacaoCarbono: req.body.compensacaoCarbono,
            acoesSustentabilidade: req.body.acoesSustentabilidade
        };

        const openai = new OpenAI({
            apiKey: process.env.API_KEY
        });

        const prompt = `Você é um especialista em sustentabilidade empresarial. Analise os seguintes dados de uma empresa e forneça uma avaliação completa.
        DADOS DA EMPRESA:
        - Número de funcionários: ${dadosFormulario.funcionarios}
        - Setor de atuação: ${dadosFormulario.setor}
        - Controle de energia: ${dadosFormulario.controleEnergia}
        - Práticas de energia: ${dadosFormulario.praticasEnergia || 'Não informado'}
        - Controle de água: ${dadosFormulario.controleAgua}
        - Destinação de resíduos: ${dadosFormulario.destinacaoResiduos || 'Não informado'}
        - Compensação de carbono: ${dadosFormulario.compensacaoCarbono}
        - Ações de sustentabilidade: ${dadosFormulario.acoesSustentabilidade || 'Não informado'}

        INSTRUÇÕES:
        Analise esses dados e retorne APENAS um JSON válido com a seguinte estrutura exata:

        {
        "notas": {
            "sustentabilidade": <número de 0 a 100>,
            "emissoesCO2": <número de 0 a 100>,
            "consumoEnergia": <número de 0 a 100>,
            "consumoAgua": <número de 0 a 100>,
            "geracaoDestinacaoResiduos": <número de 0 a 100>
        },
        "recomendacoes": [
            "<recomendação 1>",
            "<recomendação 2>",
            "<recomendação 3>",
            "<recomendação 4>"
        ],
        "metas": [
            "<meta 1>",
            "<meta 2>",
            "<meta 3>",
            "<meta 4>"
        ]
        }

        IMPORTANTE:
        - Retorne APENAS o JSON, sem texto adicional antes ou depois
        - As notas devem ser números inteiros de 0 a 100
        - As recomendações devem ser práticas e específicas para a empresa
        - As metas devem ser mensuráveis e alcançáveis
        - Considere o setor e tamanho da empresa na análise`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Você é um especialista em sustentabilidade empresarial. Sempre retorne apenas JSON válido, sem texto adicional."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const respostaTexto = completion.choices[0].message.content;
        let analise = JSON.parse(respostaTexto);

        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoFormularios = banco.collection('formularios');
        const colecaoUsuarios = banco.collection('usuarios');

        const empresa = await colecaoUsuarios.findOne({ email: req.session.email });

        const resultado = await colecaoFormularios.insertOne({
            emailUsuario: req.session.email,
            usuarioId: empresa?._id,
            dadosFormulario: dadosFormulario,
            analise: analise,
            dataCriacao: new Date()
        });

        req.session.ultimaAnaliseId = resultado.insertedId.toString();

        res.redirect('/recomendacoes');

    } catch (erro) {
        console.error('Erro ao processar formulário:', erro);
        res.status(500).send('Erro ao processar a análise. Tente novamente. <br> <a href="/formulario">Voltar</a>');
    } finally {
        await cliente.close();
    }
});

app.get('/recomendacoes', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo);

    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoFormularios = banco.collection('formularios');
        const colecaoUsuarios = banco.collection('usuarios');

        let analiseDoc;
        if (req.session.ultimaAnaliseId) {
            const ObjectId = require('mongodb').ObjectId;
            analiseDoc = await colecaoFormularios.findOne({ 
                _id: new ObjectId(req.session.ultimaAnaliseId),
                emailUsuario: req.session.email 
            });
        }

        if (!analiseDoc) {
            analiseDoc = await colecaoFormularios.findOne(
                { emailUsuario: req.session.email },
                { sort: { dataCriacao: -1 } }
            );
        }

        if (!analiseDoc) {
            return res.redirect('/formulario');
        }

        const empresa = await colecaoUsuarios.findOne({ email: req.session.email });

        function getCorClasse(nota) {
            if (nota < 30) {
                return 'nota-vermelha';
            } else if (nota < 75) {
                return 'nota-laranja';
            } else {
                return 'nota-verde';
            }
        }

        let html = fs.readFileSync(__dirname + '/views/recomendacoes.html', 'utf8');
        
        html = html.replace(/{{NOME_USUARIO}}/g, empresa?.nome || '');
        
        const notaSustentabilidade = analiseDoc.analise.notas.sustentabilidade || 0;
        const notaEmissoes = analiseDoc.analise.notas.emissoesCO2 || 0;
        const notaEnergia = analiseDoc.analise.notas.consumoEnergia || 0;
        const notaAgua = analiseDoc.analise.notas.consumoAgua || 0;
        const notaResiduos = analiseDoc.analise.notas.geracaoDestinacaoResiduos || 0;

        html = html.replace(/{{NOTA_SUSTENTABILIDADE}}/g, notaSustentabilidade);
        html = html.replace(/{{COR_SUSTENTABILIDADE}}/g, getCorClasse(notaSustentabilidade));
        
        html = html.replace(/{{NOTA_EMISSOES}}/g, notaEmissoes);
        html = html.replace(/{{COR_EMISSOES}}/g, getCorClasse(notaEmissoes));
        
        html = html.replace(/{{NOTA_ENERGIA}}/g, notaEnergia);
        html = html.replace(/{{COR_ENERGIA}}/g, getCorClasse(notaEnergia));
        
        html = html.replace(/{{NOTA_AGUA}}/g, notaAgua);
        html = html.replace(/{{COR_AGUA}}/g, getCorClasse(notaAgua));
        
        html = html.replace(/{{NOTA_RESIDUOS}}/g, notaResiduos);
        html = html.replace(/{{COR_RESIDUOS}}/g, getCorClasse(notaResiduos));

        const recomendacoes = analiseDoc.analise.recomendacoes || [];
        let recomendacoesHTML = '';
        recomendacoes.forEach((rec) => {
            recomendacoesHTML += `<li>${rec}</li>`;
        });
        html = html.replace(/{{RECOMENDACOES}}/g, recomendacoesHTML || '<li>Nenhuma recomendação disponível.</li>');

        const metas = analiseDoc.analise.metas || [];
        let metasHTML = '';
        metas.forEach((meta) => {
            metasHTML += `<li>${meta}</li>`;
        });
        html = html.replace(/{{METAS}}/g, metasHTML || '<li>Nenhuma meta disponível.</li>');

        res.send(html);

    } catch (err) {
        console.error(err);
        res.send("Erro ao carregar recomendações. <br> <a href='/dashboard'>Voltar ao Dashboard</a>");
    } finally {
        await cliente.close();
    }
});

app.get('/erro', (req, res) => {
    res.sendFile(__dirname + '/views/erro.html');
});

app.get('/sair', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send('Erro ao sair!');
        }
        res.redirect('/');
    });
});

app.listen(porta, () => {
    console.log(`Servidor rodando em: http://localhost:${porta}`);
});

const port = process.env.PORT || 3000;
app.listen(port);

