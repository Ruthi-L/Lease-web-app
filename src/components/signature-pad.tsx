"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

type SignaturePadProps = {
  initialSignature: string | null;
  onSave: (dataUrl: string) => void;
};

export default function SignaturePad({ initialSignature, onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(initialSignature));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    const width = 900;
    const height = 260;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#236b4e";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    if (!initialSignature) {
      setHasInk(false);
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, width, height);
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      setHasInk(true);
    };
    image.src = initialSignature;
  }, [initialSignature]);

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * (canvas.width / (bounds.width * (window.devicePixelRatio || 1))), y: (event.clientY - bounds.top) * (canvas.height / (bounds.height * (window.devicePixelRatio || 1))) };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const point = pointFromEvent(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
    setHasInk(true);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const point = pointFromEvent(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onSave("");
  }

  function save() {
    const canvas = canvasRef.current;
    if (canvas && hasInk) onSave(canvas.toDataURL("image/png"));
  }

  return <div className="signature-pad"><canvas ref={canvasRef} width={900} height={260} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onPointerLeave={stopDrawing} aria-label="Draw your signature" /><div className="signature-actions"><button type="button" className="secondary-button" onClick={clear}>Clear</button><button type="button" className="primary-button" onClick={save} disabled={!hasInk}>Save signature <span>✓</span></button></div></div>;
}