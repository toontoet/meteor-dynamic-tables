
const tableRecords = new Mongo.Collection("tableInformation");
const remoteTableRecords = [];

export function getTableRecordsCollection(connection) {
  if (!connection || connection === tableRecords._connection) return tableRecords;

  let remote = _.find(remoteTableRecords, _remote => _remote.connection === connection);
  if (!remote) {
    remote = {
      connection,
      tableRecords: new Mongo.Collection("tableInformation", { connection })
    };
    remoteTableRecords.push(remote);
  }
  return remote.tableRecords;
}
