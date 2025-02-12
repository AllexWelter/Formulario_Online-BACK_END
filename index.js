import express from 'express'
const app = express()


//Rota para teste
app.get('/', (req,res) => {
    res.send('Servidor está funcionando! 🚀')
})

app.listen(3000, () =>{
    console.log('Servidor Rodando')
})


app.use(express.json())