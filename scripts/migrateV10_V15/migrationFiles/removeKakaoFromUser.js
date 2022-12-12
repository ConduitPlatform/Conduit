const db = require('../mongoConnection');

const migrateRemoveKakaoFromUser = async () => {
  const documents = db.collection('_declaredschemas');
  const schema = await documents.findOne({ name: 'User' });

  if (schema?.fields?.kakao || schema?.compiledFields?.kakao) {
   await documents.updateOne({ name: 'User' }, { $unset: { 'fields.kakao': '' , 'compiledFields.kakao': '' } });
  }

  await db.collection('users').updateMany({'fields.kakao': { $exists: true }}, { $unset: { 'fields.kakao': '' ,'compiledFields.kakao': ''} });

};

module.exports = migrateRemoveKakaoFromUser;