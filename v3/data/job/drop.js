/* global build */

document.ondragover = e => e.preventDefault();
document.ondrop = e => {
  e.preventDefault();

  build([...e.dataTransfer.files]);
};
