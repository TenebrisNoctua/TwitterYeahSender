function removeByValue(array, val) {
    for (let i = 0; i < array.length; i++) {
        if (array[i] === val) {
            array.splice(i, 1);
            i--;
        }
    }
    return array;
}

function timeOut(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}