import process from 'process';

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  let response = {
    status: error.status || 500,
    message: `Ups, something bad happened: ${error.message}`,
    error: error
  };
  if (process.env.ENV !== 'development') {
    response.status = '500';
    response.message = `🤦‍♂️, something bad happened`
  }
  res.render('error.ejs', response);
};

export default errorHandler;