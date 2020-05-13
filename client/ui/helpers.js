// Find lowest useable integer starting at 0, given a list of used integers. 
export function nextId(values) {
    let found = false;
    let i = 0;
    while(!found) {
      if(!values.includes(i)) {
        found = true;
      }
      if(!found) {
        i++;
      }
    }
    return i;
}