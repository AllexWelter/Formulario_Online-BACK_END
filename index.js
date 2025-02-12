const app = express()
const userRoutes = require('./routes/userRoutes')


//Rota para teste
app.get('/', (req,res) => {
    res.send('Servidor está funcionando! 🚀')
})

app.listen(3000, () =>{
    console.log('Servidor Rodando')
})


app.use(express.json())
app.use('/api', userRoutes)