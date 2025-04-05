const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const express = require('express');
const router = express.Router();
const authJwtController = require('./auth_jwt');

// Movie schema
const MovieSchema = new Schema({
  title: { type: String, required: true, index: true },
  releaseDate: { type: Number, min: [1900, 'Must be greater than 1899'], max: [2100, 'Must be less than 2100']},
  genre: {
    type: String,
    enum: [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Western', 'Science Fiction'
    ],
  },
  actors: [{
    actorName: String,
    characterName: String,
  }],
});

// Create Movie model
const Movie = mongoose.model('Movie', MovieSchema);

// GET all movies
router.get('/', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const movies = await Movie.find();
    res.status(200).json(movies);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
router.post('/', authJwtController.isAuthenticated, async (req, res) => {
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
    res.status(201).json({ success: true, message: 'Movie created!', movie: movie });
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

module.exports = router;
module.exports.Movie = Movie;
