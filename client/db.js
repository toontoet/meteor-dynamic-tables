
const tableRecords = new Mongo.Collection("tableInformation");
const tableGroupsInfo = new Mongo.Collection("groupInfo");
const remoteTableRecords = [];

const remoteGroupInfos = [];

export function getGroupedInfoCollection(connection) {
  if (!connection || connection === tableGroupsInfo._connection) return tableGroupsInfo;

  let remote = _.find(remoteTableRecords, _remote => _remote.connection === connection);
  if (!remote) {
    remote = {
      connection,
      tableRecords: new Mongo.Collection("groupInfo", { connection })
    };
    remoteGroupInfos.push(remote);
  }
  return remote.tableRecords;
}
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
