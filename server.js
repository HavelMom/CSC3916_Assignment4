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
var mongoose = require('mongoose');


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

// POST /reviews - Create a new review (secured with JWT)
router.post('/reviews', authJwtController.isAuthenticated, async (req, res) => {
  const { movieId, review, rating } = req.body;

  // 1) Required fields
  if (!movieId || !review || typeof rating === 'undefined') {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  // 2) movieId must be a real Movie
  let movie;
  try {
    movie = await Movie.findById(movieId);
  } catch (err) {
    // handles invalid ObjectId format
    return res.status(400).json({ message: 'Invalid movieId' });
  }
  if (!movie) {
    return res.status(400).json({ message: 'Invalid movieId' });
  }

  // 3) All good—attach username & save
  const newReview = new Review({
    movieId,
    username: req.user.username,
    review,
    rating
  });

  newReview.save(err => {
    if (err) return res.status(500).json({ message: err.message });
    return res.status(200).json({ message: 'Review created!' });
  });
});

router.get('/reviews', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const reviews = await Review.find();
    return res.status(200).json(reviews);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
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
  
// GET all movies, with optional ?reviews=true
router.get(['/', '/movies'], authJwtController.isAuthenticated, async (req, res) => {
  try {
    if (req.query.reviews === 'true') {
      const moviesWithReviews = await Movie.aggregate([
        {
          $lookup: {
            from:         'reviews',
            localField:   '_id',
            foreignField: 'movieId',
            as:           'reviews'
          }
        }
      ]);
      return res.status(200).json(moviesWithReviews);
    }
    const movies = await Movie.find();
    res.status(200).json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET movie by title
router.get('/:title', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const movie = await Movie.findOne({ title: req.params.title });
    
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    
    res.status(200).json(movie);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST new movie
router.post(['/', '/movies'], authJwtController.isAuthenticated, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.title || !req.body.releaseDate || !req.body.genre) {
      return res.status(400).json({ success: false, message: 'Please provide title, releaseDate, and genre' });
    }

    // Validate actors array
    if (!req.body.actors || !Array.isArray(req.body.actors) || req.body.actors.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one actor' });
    }

    // Validate each actor has required fields
    for (const actor of req.body.actors) {
      if (!actor.actorName || !actor.characterName) {
        return res.status(400).json({ success: false, message: 'Each actor must have actorName and characterName' });
      }
    }

    // Check if movie already exists
    const existingMovie = await Movie.findOne({ title: req.body.title });
    if (existingMovie) {
      return res.status(400).json({ success: false, message: 'Movie already exists' });
    }

    // Create new movie
    const newMovie = new Movie({
      title: req.body.title,
      releaseDate: req.body.releaseDate,
      genre: req.body.genre,
      actors: req.body.actors
    });

    // Save movie to database
    const movie = await newMovie.save();
    res.status(200).json({ success: true, message: 'Movie created!', movie });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update movie
router.put('/:title', authJwtController.isAuthenticated, async (req, res) => {
  try {
    // Find movie by title
    const movie = await Movie.findOne({ title: req.params.title });
    
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    // Build movie object with updates
    const movieFields = {};
    if (req.body.title) movieFields.title = req.body.title;
    if (req.body.releaseDate) movieFields.releaseDate = req.body.releaseDate;
    if (req.body.genre) movieFields.genre = req.body.genre;
    
    if (req.body.actors) {
      // Validate actors array
      if (!Array.isArray(req.body.actors) || req.body.actors.length === 0) {
        return res.status(400).json({ success: false, message: 'Please provide at least one actor' });
      }
      
      // Validate each actor has required fields
      for (const actor of req.body.actors) {
        if (!actor.actorName || !actor.characterName) {
          return res.status(400).json({ success: false, message: 'Each actor must have actorName and characterName' });
        }
      }
      
      movieFields.actors = req.body.actors;
    }

    // Update movie
    const updatedMovie = await Movie.findOneAndUpdate(
      { title: req.params.title },
      { $set: movieFields },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({ success: true, message: 'Movie updated!', movie: updatedMovie });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE movie
router.delete('/:title', authJwtController.isAuthenticated, async (req, res) => {
  try {
    // Find movie by title
    const movie = await Movie.findOne({ title: req.params.title });
    
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    
    // Delete movie
    await Movie.deleteOne({ title: req.params.title });
    
    res.status(200).json({ success: true, message: 'Movie deleted!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Use routes
app.use('/', router);
app.use('/movies', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only


