const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
const porta = 3000;
const path = require('path')
 
app.use('/img', express.static(path.join(__dirname, 'views', 'img')));
app.use('/style', express.static(path.join(__dirname, 'views', 'style')));
 
app.use(express.urlencoded({extended: true }));
app.use(express.json());
app.use(session({
secret: 'arrozEfeijao',
resave: false,
saveUninitialized: true,
}));
 
const urlMongo = 'mongodb://localhost:27017';
const nomeBanco = 'EcoMind';
 
app.get('/', (req, res) =>{
    res.sendFile(__dirname + '/views/home.html')
})
 
 
app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/views/registrar.html');
});
 
app.post('/register', async (req, res) => {
        const cliente = new MongoClient(urlMongo);
        try{  
            await cliente.connect();
            const banco = cliente.db(nomeBanco);
            const colecaoUsuarios = banco.collection('usuarios');
 
            const usuarioExistente = await colecaoUsuarios.findOne({ email: req.body.email });
            if (usuarioExistente) {
            res.send('Usuário já existe! Tente outro nome de usuário.');
            }else{
                const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);
 
                await colecaoUsuarios.insertOne({
                    nome: req.body.nome,
                    email: req.body.email,
                    senha: senhaCriptografada
                });
                res.redirect('/login');
            }
        } catch (erro) {
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
 
            const email = await colecaoUsuarios.findOne({ email: req.body.email });
 
 
            if (email && await bcrypt.compare(req.body.senha, email.senha)) {
                req.session.email = req.body.email;
                res.redirect('/bemvindo');
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
 
function protegerRota(req, res, proximo){
    if(req.session.email){
        proximo();
    } else{
        res.redirect('/login');
    }
}
 
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});
 
app.get('/bemvindo', protegerRota,  (req, res) => {
    res.send(`Olá <br>  <a href="/sair">voltar</a> `)
});-
 
app.get('/exRotaProtegida', protegerRota, (req, res) => {
    res.send(`Olá, ${req.session.usuario}!<br>  <a href="/#">voltar</a>`);
});
 
app.get('/exRotaProtegida', protegerRota, (req, res) => {
    res.send(`Olá, ${req.session.usuario}! <br> <a href="/#">voltar</a>`);
});
 
app.get('/exRotaProtegida', protegerRota, (req, res) => {
    res.send(`Olá, ${req.session.usuario}! <br>  <a href="/#">voltar</a> `);
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
    console.log(`Servidor rodando na porta http://localhost:${porta}`);
});