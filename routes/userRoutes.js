import express from 'express'
const router = express.Router()
const connection = require('../database')

//rota pra criar novo user
router.post('/users', (req,res) => {
    const { nome, email} = req.body

    //validação manual sem yup
    if(!nome || nome.trim() === '') {
        return res.status(400).json({error: 'O nome é obrigatório'})
    }

    if(!email || !email.includes('@')) {
        return res.status(400).json({error: 'E-mail inválido'})
    }

    //inserindo no banco
    connection.query('INSERT INTO id_usuario (nome, email) VALUES (?, ?)', [nome, email], (err, results) => {
        if(err) {
            return res.status(500).json({error: err.message})
        }
        res.status(201).json({id: results.insertId, nome, email})
    })
})


//rota para listar users
router.get('/users', (req,res) => {
    connection.query('SELECT * FROM id_usuario', (err, results) => {
        if (err) {
            return res.status(500).json({error: err,message})
        }
        res.json(results)
    })
})

module.exports = router