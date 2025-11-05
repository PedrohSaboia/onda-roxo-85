import { useState } from 'react';
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

 return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Logística</h1>
        <p className="text-muted-foreground">
          Gerencie etiquetas de envio e conferência de pedidos
        </p>
      </div> 
    </div>
  );
}