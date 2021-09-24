function extractType(field: any) {
  switch (field) {
    case 'ObjectId':
      return 'string';
    case 'String':
      return 'string';
    case 'Number':
      return 'number';
    case 'Date':
      return 'Date';
    default:
      return field;
  }
}

export function parseFieldsToTs(fields: any) {
  let typings = '';
  for (let field in fields) {
    if (typeof fields[field] === 'string') {
      typings += `${field}: ${extractType(fields[field])};\n`;
    } else if (fields[field].enum) {
      let types = (fields[field].enum as string[])
        .map((val) => "'" + val + "'")
        .join(' | ');
      typings += `${field}${fields[field].required ? '!' : ''}: ${types};\n`;
    } else if (fields[field].type === 'Relation') {
      let name =
        fields[field].model.charAt(0).toUpperCase() + fields[field].model.slice(1);
      typings += `${field}${fields[field].required ? '!' : ''}: ${name};\n`;
    } else if (typeof fields[field].type === 'string') {
      typings += `${field}${fields[field].required ? '!' : ''}: ${extractType(
        fields[field].type
      )};\n`;
    } else if (
      Array.isArray(fields[field].type) &&
      typeof fields[field].type[0] === 'object'
    ) {
      if (fields[field].type[0].type) {
        let fieldParse = parseFieldsToTs({ [field]: fields[field].type[0] });
        fieldParse = fieldParse.replace(';', '[];');
        typings += fieldParse;
      } else {
        let fieldParse = parseFieldsToTs(fields[field].type[0]);
        typings += `${field}${fields[field].required ? '!' : ''}: {${fieldParse}}[];\n`;
      }
    } else if (Array.isArray(fields[field].type)) {
      typings += `${field}${fields[field].required ? '!' : ''}: ${extractType(
        fields[field].type[0]
      )}[];\n`;
    } else if (typeof fields[field].type === 'object') {
      typings += `${field}${fields[field].required ? '!' : ''}: {${parseFieldsToTs(
        fields[field].type
      )}};\n`;
    }
  }
  console.log(typings);
  return typings;
}
