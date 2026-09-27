/**
 * Swaps two elements in an array in-place.
 */
function swap(arr, i, j) {
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}

/**
 * Lomuto-style partition with a randomly chosen pivot element.
 *
 * @param {Array<number>} arr Array to partition
 * @param {number} left Start index
 * @param {number} right End index
 * @param {number} pivotIndex Selected pivot index
 * @returns {number} Final position of the pivot
 */
function partition(arr, left, right, pivotIndex) {
  const pivotValue = arr[pivotIndex];
  // Move pivot out of the way to the end
  swap(arr, pivotIndex, right);
  let storeIndex = left;

  for (let i = left; i < right; i++) {
    if (arr[i] < pivotValue) {
      swap(arr, storeIndex, i);
      storeIndex++;
    }
  }

  // Move pivot to its final sorted position
  swap(arr, storeIndex, right);
  return storeIndex;
}

/**
 * Randomized Quickselect implementation to find the k-th smallest element (0-indexed).
 *
 * Time Complexity:
 * - Expected Average: O(n)
 * - Worst Case: O(n^2) (mitigated by uniform random pivot choice)
 * Space Complexity: O(log n) stack space average.
 *
 * @param {Array<number>} arr Array to select from (mutated in-place)
 * @param {number} k Target rank (0-indexed)
 * @param {number} [left=0] Subarray left bound
 * @param {number} [right=arr.length - 1] Subarray right bound
 * @returns {number} The value at rank k
 */
function quickselect(arr, k, left = 0, right = arr.length - 1) {
  if (left === right) {
    return arr[left];
  }

  // Pick random pivot between left and right inclusive
  const pivotIndex = left + Math.floor(Math.random() * (right - left + 1));
  const newPivotIndex = partition(arr, left, right, pivotIndex);

  if (k === newPivotIndex) {
    return arr[k];
  } else if (k < newPivotIndex) {
    return quickselect(arr, k, left, newPivotIndex - 1);
  } else {
    return quickselect(arr, k, newPivotIndex + 1, right);
  }
}

/**
 * Computes the median of an array of numbers using randomized Quickselect in O(n) expected time.
 *
 * - For an odd-length array of length n, returns element at rank floor(n / 2).
 * - For an even-length array of length n, returns average of elements at ranks (n / 2 - 1) and (n / 2).
 * - For single element array, returns that element.
 * - For empty array, returns 0.
 *
 * @param {Array<number>} numbers Input array of numeric values
 * @returns {number} Computed median value
 */
function quickselectMedian(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return 0;
  }

  const clean = numbers
    .map(Number)
    .filter((n) => !isNaN(n));

  const n = clean.length;
  if (n === 0) return 0;
  if (n === 1) return clean[0];

  if (n % 2 === 1) {
    const k = Math.floor(n / 2);
    return quickselect(clean, k);
  } else {
    const k1 = n / 2 - 1;
    const k2 = n / 2;
    const val1 = quickselect(clean, k1);
    const val2 = quickselect(clean, k2);
    return (val1 + val2) / 2;
  }
}

quickselectMedian.quickselectMedian = quickselectMedian;
quickselectMedian.quickselect = quickselect;
module.exports = quickselectMedian;
module.exports.quickselectMedian = quickselectMedian;
