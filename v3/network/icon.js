/* global network*/

// update network blocked list
{
  const image = async href => {
    const img = await createImageBitmap(await (await fetch(href)).blob());
    const {width: w, height: h} = img;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    return ctx.getImageData(0, 0, w, h);
  };

}
