
# Formulário Online (Quiz)

## Descrição do Projeto
O **Formulário Online (Quiz)** é um projeto de questionário interativo onde os usuários podem responder a 10 perguntas com 4 alternativas cada. No final, a pontuação é exibida na tela, e há a opção de enviar o resultado por e-mail.

## Tecnologias Utilizadas

### Frontend
- React
- React Bootstrap
- React Router DOM
- Axios

### Backend
- Node.js
- Express
- MySQL2
- Dotenv
- CORS
- Nodemailer
- Nodemon
- Yup

## Como Rodar o Projeto

### 1. Clonar os Repositórios
```bash
# Backend
git clone https://github.com/AllexWelter/Formulario_Online-BACK_END.git

# Frontend
git clone https://github.com/AllexWelter/Formul-rio_Online-REACT.git
```

### 2. Configurar o Backend
```bash
cd Formulario_Online-BACK_END
npm install
```
Criar um arquivo `.env` e configurar as credenciais do banco de dados e e-mail.

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=quiz_db
EMAIL_USER=seu_email
EMAIL_PASS=sua_senha
```

Iniciar o backend:
```bash
npm start
```

### 3. Configurar o Frontend
```bash
cd ../Formul-rio_Online-REACT
npm install
npm start
```
O frontend será iniciado em `http://localhost:3000`.

## Endpoints da API

### Criar um Quiz
**POST** `/api/iniciar`
- Verifica se o usuário existe, cria um registro e inicia o quiz.

### Buscar Perguntas
**GET** `/api/perguntas/:numero`
- Retorna uma pergunta e suas alternativas com base no ID.

### Enviar Respostas
**POST** `/api/enviar`
- Valida e registra as respostas do usuário, calcula a pontuação e salva no banco.

### Enviar Resultado por Email
**GET** `/api/email/:idQuiz`
- Verifica o quiz e envia um e-mail com a pontuação.

## Estrutura do Banco de Dados

### Tabela `usuarios`
Armazena informações dos usuários.

| id_usuario | nome | email |
|------------|------|-------|

### Tabela `usuario_quiz`
Registra a participação dos usuários no quiz.

| id_quiz | id_usuario | data_inicio | data_termino | pontuacao |
|---------|------------|-------------|--------------|-----------|

### Tabela `perguntas`
Lista as perguntas do quiz.

| id_pergunta | texto |
|-------------|-------|

### Tabela `alternativas`
Contém as alternativas de cada pergunta.

| id_alternativa | id_pergunta | texto | pontuacao |
|---------------|-------------|-------|-----------|

### Tabela `usuarios_quiz_respostas`
Registra as respostas dos usuários.

| id_quiz_resposta | id_quiz | id_alternativa |
|------------------|--------|--------------|

## Contribuição
Sinta-se à vontade para testar e contribuir com melhorias! 🚀

