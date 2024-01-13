import process from 'process';

const errorHandler = (error, req, res, next) => {
  if (error) {
    let response = {
      status: error.status || 500,
      message: `Ups, something bad happened: ${error.message}` || 'Ups, something bad happened: Internal Server Error',
      error: error
    };
    if (process.env.ENV !== 'development') {
      response.status = '500';
      response.message = `🤦‍♂️, something bad happened`
    }
    res.render('error.ejs', response);
  } else {
    next();
  }
};

export default errorHandler;