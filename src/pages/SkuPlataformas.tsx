import React from 'react';
import EstoqueSidebar from '@/components/layout/EstoqueSidebar';

export function SkuPlataformas() {
  return (
    <div className="min-h-screen bg-background">
      <main className="min-h-[calc(100vh-8rem)]">
        <div className="flex items-start gap-6">
          <EstoqueSidebar />

          <div className="flex-1 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">SKU Plataformas</h1>
                <p className="text-sm text-muted-foreground mt-1">Gerencie os SKUs vinculados às plataformas externas.</p>
              </div>
            </div>

            <div className="bg-white border rounded p-6">
              <p className="text-sm text-muted-foreground">Aqui você pode mapear e gerenciar SKUs por plataforma (placeholder).</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default SkuPlataformas;
