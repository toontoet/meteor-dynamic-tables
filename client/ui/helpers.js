import { DynamicTableSpecs } from "meteor/znewsham:justplay-common";

// Find lowest useable integer starting at 0, given a list of used integers.
export function nextId(values) {
  let found = false;
  let i = 0;
  while (!found) {
    if (!values.includes(i)) {
      found = true;
    }
    if (!found) {
      i++;
    }
  }
  return i;
}

// Adding helper for easily pulling data from jQuery elements.
export function jQueryData(element, ...values) {
  return values.map(value => element.currentTarget  ? $(element.currentTarget).data(value) : element.data(value));
}

// Returns true if arrays are equal, can be out of order.
export function arraysEqual(arrayA, arrayB) {
  if(!arrayA || !arrayB) {
    return arrayA === arrayB;
  }
  return _.isEqual(_.sortBy(_.keys(arrayA)), _.sortBy(_.keys(arrayB)));
}

// Given a collection, chain and value, generate all nested table Ids. @this is expected to support a call to subscribe.
export function getNestedTableIds(templInstance, tableId, collection, value, field, groupChain, filter) {
  const selector = getSelector(value, field);
  const tableIds = [];
  return new Promise(resolve => {
    if(groupChain.length) {
      // Using the provided selector, subscribe to any record that may appear in any nested table that is part of this table.
      templInstance.subscribe(collection._name, selector, () => {
        let records = collection.find(selector).fetch();

        groupChain.forEach(field => {
          records = applyGroup(field, records);
        });

        const tableIds = generateIds(records, tableId);

        // If there's a filter provided, remove any tableIds that have differing filters.
        if(filter) {
          const dynamicTableSpecsQuery = {tableId: { $in: tableIds}};

          // Subscribe to any table spec that has the same table id as any of the generated ones.
          templInstance.subscribe("dynamicTableSpecs", dynamicTableSpecsQuery, () => {
            const records = DynamicTableSpecs.find(dynamicTableSpecsQuery).fetch();
            records.forEach(record => {
              if(record.tableSpec && record.tableSpec.filter && !_.contains(["{}", filter], record.tableSpec.filter)) {
                tableIds.splice(tableIds.indexOf(record.tableId), 1);
              }
            });
            resolve(tableIds);
          });
        } else {
          // Generate the table ids using the grouped records.
          resolve(tableIds);
        }
      });
    } else {
      resolve([tableId]);
    }
  });
}

// Given a field, create groups for that particular field. Recursively apply groups to nested groups.
function applyGroup(field, records) {
  let results = []; 
  records.forEach(record => {
    if(record && record.records && record.records.length) {

      // If the record has records, recursively apply grouping to the records.
      results.push({
        field: record.field,
        value: record.value,
        records: applyGroup(field, record.records)
      });
    } else {

      // Sometimes the value is an array of values, indicating that the record is part of multiple groups.
      const values = [].concat(getValue(record, field));
      values.forEach(value => {
        let group = results.find(val => val.value === value);
        if(!group) {
          group = {
            field,
            value,
            records: []
          };
          results.push(group);
        }
        group.records.push(record);
      });
    }
  });

  return results;
}

// Given an array of objects produced by applyGroup, recursively generate table ids.
function generateIds(records, tableId) {
  let results = [tableId];
  records.forEach(record => {
    let newTableId;
    if(record.value) {
      newTableId = (tableId || "") + selectorToId(getSelector({query: record.value}, record.field));
      results.push(newTableId);
    } else {
      newTableId = (tableId || "") + selectorToId(getSelector({ 
        query: { 
          $not: { 
            $in: records.filter(val => val.value).map(val => val.value)
          }
        }
      }, record.field));
      results.push(newTableId);
    }
    if(record && record.records && record.records.length && record.records[0].records) {
      results = results.concat(generateIds(record.records, newTableId));
    }
  });
  return results;
}

function getSelector(value, field, isUndefined) {
  const selector = {};
  if (value.selector) {
    if (!selector.$and) {
      selector.$and = [];
    }
    selector.$and.push(value.selector);
  }
  else if (value.query.$nor) {
    if (!selector.$and) {
      selector.$and = [];
    }
    selector.$and.push(value.query);
  }
  else {
    selector[field] = value.query;
  }
  return selector;
}

function getValue(record, field) {
  let result = record;
  field.split(".").forEach(field => result = result[field]);
  return result;
}

/**
 * selectorToId - description
 *
 * @param  {object} selector      mongo selector
 * @param  {string} tableIdSuffix table suffix
 * @return {string}               table suffix
 */
export function selectorToId(selector, tableIdSuffix) {
  if (tableIdSuffix) {
    return tableIdSuffix;
  }
  return JSON.stringify(selector)
  .replace(/\\t/g, "_t_t_t_t")
  .replace(/ /g, "____")
  .replace(/[^\d\w]/g, "");
}

function formatId(value) {
  return value
    .replace(/\\t/g, "_t_t_t_t")
    .replace(/ /g, "____")
    .replace(/[^\d\w]/g, "");
}

/** @this = template instance */
export function getTableIdSuffix(value) {
  const current = this.grouping;

  const selector = {};
  if (value && value.query.$nor) {
    selector.$and = [value.query];
  }
  else if (value) {
    selector[current.field] = value.query;
  }
  const nextSuffix = value && selectorToId(selector, value.tableIdSuffix);

  const nextParts = (this.tableIdSuffixChain || []).slice(0);
  if (nextSuffix) {
    nextParts.push(nextSuffix);
  }
  return nextParts.join("");
}