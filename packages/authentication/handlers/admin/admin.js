import { isNil } from 'lodash';

async function getUsersPaginated(req, res, next) {
  const {skip, limit} = req.params;
  if (isNil(skip) || isNil(limit)) {
    return res.status(401).json({error: 'Pagination parameters are missing'});
  }
  const users = await database.getSchema('User').findPaginated(null, Number(skip), Number(limit));
  const totalCount = await database.getSchema('User').countDocuments(null);
  return res.json({users, totalCount});
}


module.exports = {
  getUsersPaginated
};
