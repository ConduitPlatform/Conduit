//to be used combined with useContext
export default function Debounce(func, wait, immediate) {
  var timeout;

  return (...args) => {
    var context = this;

    var later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    var callNow = immediate && !timeout;

    clearTimeout(timeout);

    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };
}
