const express = require('express');
const mongodb = require('mongodb');

const app = express();

const DATABASE_NAME = 'wpr-quiz';
const port = 3000;

// decode req.body from form-data
app.use(express.urlencoded({extended: true}));
// decode req.body from post body message
app.use(express.json());
app.use(express.static('public'));

let contentQuiz;
let score = 0;
let scoreText;
let selected_answers = {};
let correctAnswers = {};
let selectedAnswers = {};

app.get('/attempts', startQuiz);
async function startQuiz(req, res) {
    let questionAttempts = [];
    const listQuestions = await db.collection('questions').find().toArray();
    let copyListQuestions = listQuestions;
    
    // random questions
    for(let i = 0; i < 10; i++) {
        let index = Math.floor(Math.random() * copyListQuestions.length);
        questionAttempts.push(copyListQuestions[index]);
        copyListQuestions.splice(index, 1);
    }

    let qAttemptsNoCorrectAns = [...questionAttempts];
    
    // filter correct answers to save into db
    for(let i=0; i<questionAttempts.length; i++){
        let question_id = questionAttempts[i]._id;
        
        correctAnswers[question_id] = questionAttempts[i].correctAnswer;
        
        delete qAttemptsNoCorrectAns[i].correctAnswer
    }

    const started_at = new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"});
    contentQuiz = await db.collection('attempts').insertOne({
        "questions": questionAttempts,
        "completed": false,
        "score": score,
        "correctAnswers": correctAnswers,
        "selectedAnswers": selectedAnswers,
        "startedAt": started_at
    });

    // send quiz id and questions without correct answers
    res.status(200).send({questions: qAttemptsNoCorrectAns, contentQuiz});
}

app.post('/attempts/:id/submit', checkAnswer);
async function checkAnswer(req, res) {
    score = 0;
    
    let quiz_id = req.params.id;

    selected_answers = req.body.answers;

    const doc = await db.collection('attempts').findOne({"_id": mongodb.ObjectId(quiz_id)});
    if(doc === null) {
        res.send(404).end();
    }

    // Check selected answers with answers in db
    correctAnswers = doc.correctAnswers;
    for(let answer in selected_answers){
        for(let correctAnswer in correctAnswers){
            if(answer == correctAnswer && selected_answers[answer] == correctAnswers[correctAnswer]){
                score ++;
            }
        }
    }

    if(score < 5) {
        scoreText = "Practice more to improve it :D";
    }else if(5 <= score <= 7){
        scoreText = "Good, keep up!";
    }else if(7 <= score <=9){
        scoreText = "Well done!";
    }else {
        scoreText = "Perfect!";
    }

    const finished_at = new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"});
    await db.collection('attempts').updateOne(   
        { _id: mongodb.ObjectId(quiz_id)},
        {
            $set: {
                questions: doc.questions,
                completed: true,
                score: score,
                correctAnswers: correctAnswers,
                selectedAnswers: selected_answers,
                scoreText: scoreText,
                startedAt: doc.startedAt,
                finishedAt: finished_at

            }
        },
        { upsert: true}
    );

    res.status(200).send({
        selected_answers,
        correctAnswers,
        score,
        scoreText,
        completed: true,
    })
}

let db = null;
async function startServer() {
    const client = await mongodb.MongoClient.connect(`mongodb://localhost:27017/${DATABASE_NAME}`);
    db = client.db();

    console.log('Connected to db');

    app.listen(port);
    console.log(`Listening on port ${port}`)

}

startServer();