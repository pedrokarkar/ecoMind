const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
const porta = 3000;
const path = require('path');

app.use('/img', express.static(path.join(__dirname, 'views', 'img')));
app.use('/style', express.static(path.join(__dirname, 'views', 'style')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'arrozEfeijao',
    resave: false,
    saveUninitialized: true,
}));

const urlMongo = "mongodb://localhost:27017";
const nomeBanco = 'EcoMind';

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
            res.send('Usuário já existe! Tente outro e-mail.');
        } else {
            const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);
            await colecaoUsuarios.insertOne({
                nome: req.body.nome,
                email: req.body.email,
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

app.get('/dashboard', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/views/dashboard.html');
});

app.get('/api/usuario', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo);
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');

        const usuario = await colecaoUsuarios.findOne({ email: req.session.email });

        if (usuario) {
            res.json({ nome: usuario.nome });
        } else {
            res.status(404).json({ erro: "Usuário não encontrado" });
        }
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao buscar dados do usuário" });
    } finally {
        cliente.close();
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
