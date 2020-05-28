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
  arrayA = arrayA.filter(val => !_.isUndefined(val));
  arrayB = arrayB.filter(val => !_.isUndefined(val));
  return _.isEqual(_.sortBy(arrayA), _.sortBy(arrayB));
}

// Ensures there's always an $or and $and object in a query.
export function formatQuery(query) {

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