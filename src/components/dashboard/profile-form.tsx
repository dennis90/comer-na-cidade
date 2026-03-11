'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Commerce, Category } from '@/db/schema';

interface Props {
  commerce: Commerce | null;
  allCategories: Category[];
}

const MODALITIES = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'dine_in', label: 'Consumo no local' },
  { value: 'takeout', label: 'Retirada' },
] as const;

export function ProfileForm({ commerce, allCategories }: Props) {
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(commerce?.logoUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: commerce?.name ?? '',
    description: commerce?.description ?? '',
    address: commerce?.address ?? '',
    phone: commerce?.phone ?? '',
    whatsapp: commerce?.whatsapp ?? '',
    instagram: commerce?.instagram ?? '',
    cityId: commerce?.cityId ?? '',
  });

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);

  function toggleCat(id: string) {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleMod(val: string) {
    setSelectedMods((prev) =>
      prev.includes(val) ? prev.filter((m) => m !== val) : [...prev, val]
    );
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(file: File): Promise<string> {
    const res = await fetch('/api/upload/logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    const { uploadUrl, publicUrl } = await res.json();
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (logoFile) await uploadLogo(logoFile);

      const method = commerce ? 'PATCH' : 'POST';
      const payload = {
        ...form,
        categoryIds: selectedCats,
        modalities: selectedMods.map((m) => ({ modality: m })),
      };

      const res = await fetch('/api/commerce', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Erro ao salvar');
      window.location.reload();
    } catch {
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Informações do Comércio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-lg object-cover border" />
            )}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {logoPreview ? 'Trocar logo' : 'Adicionar logo'}
              </Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={handleLogoChange} />
              <p className="text-xs text-gray-500 mt-1">JPEG, PNG ou WebP. Máx 2MB.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva seu estabelecimento (mín. 80 caracteres para publicar)" />
            <p className="text-xs text-gray-500">{form.description.length} caracteres</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Rua, número, bairro" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              placeholder="@seurestaurante" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Categorias</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => toggleCat(cat.id)}>
                <Badge variant={selectedCats.includes(cat.id) ? 'default' : 'outline'}>
                  {cat.name}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Modalidades de Atendimento</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {MODALITIES.map((m) => (
              <button key={m.value} type="button" onClick={() => toggleMod(m.value)}>
                <Badge variant={selectedMods.includes(m.value) ? 'default' : 'outline'}>
                  {m.label}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : commerce ? 'Salvar alterações' : 'Cadastrar comércio'}
      </Button>
    </form>
  );
}
