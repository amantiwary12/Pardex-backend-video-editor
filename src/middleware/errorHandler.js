const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // File-too-large errors — Cloudinary reports these via http_code, body-parser via statusCode
  if (err.http_code === 413 || err.statusCode === 413 || /413/.test(err.message || '')) {
    statusCode = 413;
    message = 'Video file is too large to store (100MB limit). Please trim it shorter or export it at a lower resolution and try again.';
  }

  // Mongo duplicate-key error (e.g. an email that already exists)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = field === 'email'
      ? 'Email already registered'
      : `That ${field || 'value'} is already in use`;
  }

  // Mongoose schema validation error
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // Mongoose bad ObjectId / cast error
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
