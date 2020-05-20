
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