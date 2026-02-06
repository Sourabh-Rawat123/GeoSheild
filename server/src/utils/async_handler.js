const async_handler = (requestHandler) => {
  // 👇 You were missing this 'return'
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

module.exports=async_handler;