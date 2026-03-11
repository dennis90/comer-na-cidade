'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface Props {
  initialContent: string;
  commerceId: string;
}

export function MenuEditor({ initialContent, commerceId }: Props) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function uploadImage(file: File): Promise<string> {
    const res = await fetch('/api/upload/menu-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    if (!res.ok) throw new Error('Falha ao obter URL de upload');
    const { uploadUrl, publicUrl } = await res.json();
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  }

  async function handleImageInsert() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        const alt = file.name.replace(/\.[^.]+$/, '');
        setContent((prev) => `${prev}\n\n![${alt}](${url})\n`);
      } catch {
        alert('Erro ao fazer upload da imagem.');
      }
    };
    input.click();
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    for (const file of files) {
      try {
        const url = await uploadImage(file);
        const alt = file.name.replace(/\.[^.]+$/, '');
        setContent((prev) => `${prev}\n\n![${alt}](${url})\n`);
      } catch {
        alert(`Erro ao fazer upload de ${file.name}`);
      }
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erro ao salvar o cardápio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleImageInsert}>
            + Inserir imagem
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Salvo!</span>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar cardápio'}
          </Button>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        data-color-mode="light"
      >
        <MDEditor
          value={content}
          onChange={(val) => setContent(val ?? '')}
          height={500}
          preview="live"
        />
      </div>

      <p className="text-xs text-gray-500">
        {content.length} caracteres · Arraste imagens direto no editor para inserir.
        {content.length < 150 && (
          <span className="text-amber-600"> (mínimo 150 para publicar)</span>
        )}
      </p>
    </div>
  );
}
