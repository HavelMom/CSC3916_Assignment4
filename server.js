/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */

require('dotenv').config();
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');


var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});


// Import movie routes
const movieRoutes = require('./Movies');

// Use routes
app.use('/', router);
app.use('/movies', movieRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



// POST /reviews - Create a new review (secured with JWT)
router.post('/reviews', authJwtController.isAuthenticated, function(req, res) {
    var reviewData = req.body;
    // Check that the required fields are provided
    if (!reviewData.movieId || !reviewData.review || typeof reviewData.rating === 'undefined') {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    
    // Set the username from the JWT token (req.user is set by auth_jwt)
    reviewData.username = req.user.username;
    
    var newReview = new Review(reviewData);
    newReview.save(function(err) {
      if (err) return res.status(500).json({ message: err.message });
      // (Extra Credit) Optionally, add custom analytics tracking here
      res.status(201).json({ message: 'Review created!' });
    });
  });

// GET /reviews - Get all reviews (secured with JWT)
router.get('/reviews', authJwtController.isAuthenticated, function(req, res) {
    Review.find({}, function(err, reviews) {
        if (err) return res.status(500).json({ message: err.message });
        res.json(reviews);
    });
});

// GET /movies/:id - Retrieve a movie; if query parameter reviews=true, include its reviews
router.get('/movies/:id', function(req, res) {
    var movieId = req.params.id;
    if (req.query.reviews === 'true') {
      const mongoose = require('mongoose');
      Movie.aggregate([
        { $match: { _id: mongoose.Types.ObjectId(movieId) } },
        {
          $lookup: {
            from: 'reviews',         // MongoDB collection name for reviews
            localField: '_id',
            foreignField: 'movieId',
            as: 'reviews'
          }
        }
      ], function(err, result) {
        if (err) return res.status(500).json({ message: err.message });
        if (!result || result.length === 0) {
          return res.status(404).json({ message: 'Movie not found.' });
        }
        res.json(result[0]);
      });
    } else {
      // Standard lookup without reviews
      Movie.findById(movieId, function(err, movie) {
        if (err) return res.status(500).json({ message: err.message });
        if (!movie) return res.status(404).json({ message: 'Movie not found.' });
        res.json(movie);
      });
    }
  });
  


app.use('/', router);
app.listen(process.env.PORT || 3000);
module.exports = app; // for testing only


