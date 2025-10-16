const folderInput = document.getElementById('folderInput');
const fileCount = document.getElementById('fileCount');
const scanBtn = document.getElementById('scanBtn');
const tableContainer = document.getElementById('tableContainer');

let selectedFiles = [];

folderInput.addEventListener('change', e => {
  selectedFiles = Array.from(e.target.files).filter(f =>
    /\.(jpe?g|png|gif|bmp|tif|tiff|pcx)$/i.test(f.name)
  );
  fileCount.textContent = `Выбрано файлов: ${selectedFiles.length}`;
  tableContainer.innerHTML = '';
});

scanBtn.addEventListener('click', async () => {
  if (!selectedFiles.length) {
    alert('Сначала выберите папку с изображениями.');
    return;
  }

  tableContainer.innerHTML = '<p>Анализ файлов...</p>';

  const results = [];
  for (const file of selectedFiles) {
    const info = await getImageInfo(file);
    results.push(info);
  }

  renderTable(results);
});

async function getImageInfo(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (['tif', 'tiff'].includes(ext)) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const tiff = new Tiff({ buffer: e.target.result });
          let colorDepth = tiff.bitsPerSample ? tiff.bitsPerSample.reduce((a,b)=>a+b,0) : 24;

          let xDPI = tiff.getField("XResolution");
          let yDPI = tiff.getField("YResolution");
          if(xDPI && yDPI){
            if(Array.isArray(xDPI)) xDPI = xDPI[0]/xDPI[1];
            if(Array.isArray(yDPI)) yDPI = yDPI[0]/yDPI[1];
            xDPI = Math.round(xDPI);
            yDPI = Math.round(yDPI);
          } else xDPI = yDPI = 'Не указано';

          resolve({
            name: file.name,
            width: tiff.width(),
            height: tiff.height(),
            resolution: xDPI !== 'Не указано' ? `${xDPI}×${yDPI}` : 'Не указано',
            colorDepth: colorDepth,
            compression: 'TIFF'
          });
        } catch {
          resolve({
            name: file.name,
            width: '—',
            height: '—',
            resolution: 'Ошибка чтения TIFF',
            colorDepth: '—',
            compression: 'TIFF'
          });
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // JPEG/PNG/GIF/BMP/PCX
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const arrayBuffer = e.target.result;
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        let resolution = 'Не указано';

        // DPI для JPEG
        if(/\.(jpe?g)$/i.test(file.name)){
          try {
            const tags = EXIF.readFromBinaryFile(arrayBuffer);
            let xDPI = tags.XResolution;
            let yDPI = tags.YResolution;
            const unit = tags.ResolutionUnit;
            if(xDPI && yDPI && (unit===2 || unit===3)){
              if(Array.isArray(xDPI)) xDPI = xDPI[0]/xDPI[1];
              if(Array.isArray(yDPI)) yDPI = yDPI[0]/yDPI[1];
              xDPI = Math.round(xDPI);
              yDPI = Math.round(yDPI);
              resolution = `${xDPI}×${yDPI}`;
            }
          } catch{}
        }

        resolve({
          name: file.name,
          width: img.width,
          height: img.height,
          resolution: resolution,
          colorDepth: 24,
          compression: getCompression(file.name)
        });
      };

      img.onerror = () => {
        resolve({
          name: file.name,
          width: '—',
          height: '—',
          resolution: 'Ошибка загрузки',
          colorDepth: '—',
          compression: getCompression(file.name)
        });
      };

      img.src = url;
    };
    reader.readAsArrayBuffer(file);
  });
}

function getCompression(name) {
  const ext = name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'JPEG (с потерями)';
    case 'png':
      return 'PNG (без потерь)';
    case 'gif':
      return 'LZW (палитра)';
    case 'tif':
    case 'tiff':
      return 'TIFF';
    case 'bmp':
      return 'Без сжатия';
    case 'pcx':
      return 'RLE';
    default:
      return 'Неизвестно';
  }
}

function renderTable(data) {
  if (!data.length) {
    tableContainer.innerHTML = '<p>Нет данных.</p>';
    return;
  }

  let html = '<table><tr><th>Имя файла</th><th>Размер (пикс.)</th><th>Разрешение (dpi)</th><th>Глубина цвета</th><th>Сжатие</th></tr>';
  for (const d of data) {
    html += `<tr>
      <td>${d.name}</td>
      <td>${d.width} × ${d.height}</td>
      <td>${d.resolution}</td>
      <td>${d.colorDepth}</td>
      <td>${d.compression}</td>
    </tr>`;
  }
  html += '</table>';
  tableContainer.innerHTML = html;
}
