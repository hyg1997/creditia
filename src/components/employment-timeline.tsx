"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatDate } from "@/lib/formatters";

interface Record {
  patron: string;
  registroPatronal: string;
  entidadFederativa: string;
  fechaAlta: string;
  fechaBaja: string;
  salarioBaseCotizacion: number;
}

interface EmploymentTimelineProps {
  records: Record[];
}

export function EmploymentTimeline({ records }: EmploymentTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Historial Laboral ({records.length} registros)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[40px]">#</TableHead>
                <TableHead className="min-w-[200px]">Patron</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Fecha Alta</TableHead>
                <TableHead>Fecha Baja</TableHead>
                <TableHead className="text-right">Salario Diario</TableHead>
                <TableHead>Periodo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, index) => {
                const year = new Date(record.fechaAlta).getFullYear();
                const isPre97 = year < 1997;
                return (
                  <TableRow key={index}>
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.patron}
                      <span className="block text-xs text-muted-foreground">
                        {record.registroPatronal}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.entidadFederativa}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(record.fechaAlta)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(record.fechaBaja)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMXN(record.salarioBaseCotizacion)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isPre97 ? "secondary" : "outline"}>
                        {isPre97 ? "Ley 73" : "Ley 97"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
