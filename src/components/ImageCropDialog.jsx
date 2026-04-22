import { useMemo, useRef, useState } from "react";

const CROP_SIZE = 320;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getImageBounds(imageSize, zoom) {
  const safeWidth = imageSize.width || 1;
  const safeHeight = imageSize.height || 1;
  const scale = Math.max(CROP_SIZE / safeWidth, CROP_SIZE / safeHeight) * zoom;
  const width = safeWidth * scale;
  const height = safeHeight * scale;

  return {
    width,
    height,
    minX: Math.min(0, CROP_SIZE - width),
    minY: Math.min(0, CROP_SIZE - height),
  };
}

function getCenteredCropPosition(imageSize, zoom) {
  const bounds = getImageBounds(imageSize, zoom);

  return {
    x: (CROP_SIZE - bounds.width) / 2,
    y: (CROP_SIZE - bounds.height) / 2,
  };
}

function normalizeCropPosition(imageSize, zoom, position) {
  const bounds = getImageBounds(imageSize, zoom);

  return {
    x: clamp(position.x, bounds.minX, 0),
    y: clamp(position.y, bounds.minY, 0),
  };
}

export function ImageCropDialog({ source, title, description, onCancel, onApply }) {
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropImageSize, setCropImageSize] = useState({ width: 1, height: 1 });
  const dragStateRef = useRef(null);

  const cropBounds = useMemo(
    () => getImageBounds(cropImageSize, cropZoom),
    [cropImageSize, cropZoom],
  );

  function handleCropImageLoad(event) {
    const imageSize = {
      width: event.currentTarget.naturalWidth || 1,
      height: event.currentTarget.naturalHeight || 1,
    };

    setCropImageSize(imageSize);
    setCropZoom(1);
    setCropPosition(getCenteredCropPosition(imageSize, 1));
  }

  function handleCropPointerDown(event) {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cropPosition.x,
      originY: cropPosition.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCropPointerMove(event) {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    setCropPosition(
      normalizeCropPosition(cropImageSize, cropZoom, {
        x: dragStateRef.current.originX + (event.clientX - dragStateRef.current.startX),
        y: dragStateRef.current.originY + (event.clientY - dragStateRef.current.startY),
      }),
    );
  }

  function handleCropPointerUp(event) {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleCropZoomChange(event) {
    const nextZoom = Number(event.target.value);
    setCropZoom(nextZoom);
    setCropPosition((current) => normalizeCropPosition(cropImageSize, nextZoom, current));
  }

  function applyCrop() {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      context.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
      context.drawImage(image, cropPosition.x, cropPosition.y, cropBounds.width, cropBounds.height);
      onApply(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.src = source;
  }

  return (
    <div className="avatar-cropper" role="dialog" aria-modal="true" aria-label={title}>
      <div className="avatar-cropper__backdrop" onClick={onCancel} />

      <div className="panel avatar-cropper__dialog">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>

        <div className="avatar-cropper__viewport-wrap">
          <div
            className="avatar-cropper__viewport"
            onPointerDown={handleCropPointerDown}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            onPointerCancel={handleCropPointerUp}
          >
            <img
              src={source}
              alt="Crop preview"
              onLoad={handleCropImageLoad}
              style={{
                width: `${cropBounds.width}px`,
                height: `${cropBounds.height}px`,
                transform: `translate(${cropPosition.x}px, ${cropPosition.y}px)`,
              }}
            />
            <div className="avatar-cropper__frame" aria-hidden="true" />
          </div>
        </div>

        <label className="auth-field" htmlFor="image-crop-zoom">
          <span>Масштаб</span>
          <input
            id="image-crop-zoom"
            className="avatar-cropper__range"
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={cropZoom}
            onChange={handleCropZoomChange}
          />
        </label>

        <div className="avatar-cropper__actions">
          <button className="landing-button landing-button--ghost" type="button" onClick={onCancel}>
            Отмена
          </button>
          <button className="auth-submit" type="button" onClick={applyCrop}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
