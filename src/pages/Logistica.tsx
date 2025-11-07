import { useState, useEffect, useRef } from 'react';
import { Truck, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockPedidos } from '@/data/mockData';
import { Pedido, EtiquetaEnvio } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function Logistica() {
  const [barcode, setBarcode] = useState('');
  const barcodeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // focus on mount
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // TODO: implement lookup/scan handling here
      console.log('Scanned code:', barcode);
      // keep focus after Enter
      setTimeout(() => barcodeRef.current?.focus(), 0);
    }
  };

 return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Logística</h1>
        <p className="text-muted-foreground">
          Gerencie etiquetas de envio e conferência de pedidos
        </p>

        <div className="mt-6">
          <input
            ref={barcodeRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => barcodeRef.current?.focus(), 0)}
            className="w-full text-2xl p-2 border rounded bg-white"
            placeholder="Escaneie o código do produto aqui"
            aria-label="Leitor de código"
          />
        </div>
      </div>
    </div>
  );
}