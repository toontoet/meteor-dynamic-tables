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

// Parses a value as an integer, returns 0 if it fails to parse, includes a warning if that happens
export function safeParseInt(value) {
  try {
    value = parseInt(value);
    return isNaN(value) ? 0 : value;
  } catch (e) {
    console.warn(e);
    return 0;
  }
}

// Adding helper for easily pulling data from jQuery elements.
export function jQueryData(element, ...values) {
  return values.map(value => element.currentTarget  ? $(element.currentTarget).data(value) : element.data(value));
}

// Returns true if arrays are equal, can be out of order.
export function arraysEqual(arrayA, arrayB, func) {
  if(func && _.isFunction(func)) {
    arrayA = arrayA.map(val => func(val));
    arrayB = arrayB.map(val => func(val));
  }
  if(!arrayA || !arrayB) {
    return arrayA === arrayB;
  }
  arrayA = arrayA.filter(val => !_.isUndefined(val));
  arrayB = arrayB.filter(val => !_.isUndefined(val));
  return _.isEqual(_.sortBy(arrayA), _.sortBy(arrayB));
}

// Returns true if the elements of arrayB are in arrayA.
export function arrayContains(arrayA, arrayB) {
  return arrayB.filter(element => _.contains(arrayA, element)).length === arrayB.length;
}

// Ensures there's always an $or and $and object in a query.
export function formatQuery(query) {

  if(!query) {
    query = {};
  }

  // Sometimes the query has a single AND field with one item that has all the fields.
  // This rule doesn't apply if the field is a nested OR group.
  if(query.$and && query.$and.length == 1 && !query.$and[0].$or) {
    query = query.$and[0]
  }

  // This method just ensures that the data has a consistent
  // structure so there aren't multiple cases when working with the queries.

  // Original format for filtering.

  // Single field is set
  if(!query.$or && !query.$and) {
    query = {
      $or: [{
        $and: [query]
      }]
    }
  
  // Single OR group, multiple fields set.
  } else if(!query.$or) {
    query = {
      $or: [query]
    }

  // Multiple OR groups, each with a single field set.
  } else if(query.$or && query.$or.length) {
    query.$or = query.$or.map(val => {
      return val.$and ? val : {
        $and: [val]
      };
    });
  }

  return query;
}

// Returns fields for an AND group provided
export function getQueryFields(queryAndGroup) {
  if(queryAndGroup.length) {
    return queryAndGroup.filter(item => _.keys(item || {}).length).map(item => {
      return _.keys(item)[0];
    });
  }
  return [];
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
  if (value && value.query && value.query.$nor) {
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

// Given a column, find all the fields affected by it.
export function getColumnFields(column) {
  const results = [column.data];

  if(column.filterModal && column.filterModal.field && column.filterModal.field.name) {
    results.push(column.filterModal.field.name);
  }

  if(_.isFunction(column.search)) {

    // Use the search function of the column to find any fields that get produced when creating a query.
    // They'll be used to identify fields in a query that were previously produced from this search function.
    // Also, it's possible for the search function to return multiple objects with different fields.
    // This makes the assumption a search function returns unique field names.
    const searchResult = [].concat(column.search({}));
    results.push(...searchResult.flatMap(item => _.keys(item)));
  }

  return results;
}

// Gets used fields for a query.
export function getFields(...values) {
  let results = [];
  values.forEach(value => {
    const keys = _.keys(value || {});
    keys.forEach(key => {
      if(_.contains(["$and", "$or"], key)) {
        results = results.concat(getFields(...[].concat(value[key])));
      } else {
        results.push(key);
      }
    });
  });
  return results;
}