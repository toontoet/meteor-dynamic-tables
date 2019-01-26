
const tableRecords = new Mongo.Collection("tableInformation");
const tableGroupsInfo = new Mongo.Collection("groupInfo");
const tableDistinctValues = new Mongo.Collection("distinctValues");
const remoteTableRecords = [];
const remoteGroupInfos = [];
const remoteDistinctValues = [];

export function getDistinctValuesCollection(connection) {
  if (!connection || connection === tableDistinctValues._connection) return tableDistinctValues;

  let remote = _.find(remoteDistinctValues, _remote => _remote.connection === connection);
  if (!remote) {
    remote = {
      connection,
      distinctValues: new Mongo.Collection("distinctValues", { connection })
    };
    remoteDistinctValues.push(remote);
  }
  return remote.distinctValues;
}

export function getGroupedInfoCollection(connection) {
  if (!connection || connection === tableGroupsInfo._connection) return tableGroupsInfo;

  let remote = _.find(remoteTableRecords, _remote => _remote.connection === connection);
  if (!remote) {
    remote = {
      connection,
      groupInfo: new Mongo.Collection("groupInfo", { connection })
    };
    remoteGroupInfos.push(remote);
  }
  return remote.groupInfo;
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
