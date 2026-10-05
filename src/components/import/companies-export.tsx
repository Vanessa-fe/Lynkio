'use client'

import Papa from 'papaparse'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { COLUMN_LABELS, type ImportField } from '@/lib/validations/company-import'

// Ligne d'exemple du modèle : montre le format attendu de chaque colonne
const TEMPLATE_EXAMPLE: Record<ImportField, string> = {
  name: 'Atelier Exemple',
  website: 'atelier-exemple.fr',
  registrationId: '123456789',
  city: 'Lyon',
  postalCode: '69002',
  sector: 'Agence de communication',
  sizeCategory: 'TPE',
  notes: 'Rencontrée au salon',
  source: 'Réseau',
  estimatedAmount: '6000',
  nextAction: 'Envoyer le devis',
  contactFirstName: 'Camille',
  contactLastName: 'Martin',
  contactRole: 'Gérante',
  contactEmail: 'camille@atelier-exemple.fr',
  contactPhone: '06 12 34 56 78',
  contactLinkedin: '',
}

function downloadTemplate() {
  const fields = Object.keys(COLUMN_LABELS) as ImportField[]
  const csv = Papa.unparse(
    {
      fields: fields.map((field) => COLUMN_LABELS[field]),
      data: [fields.map((field) => TEMPLATE_EXAMPLE[field])],
    },
    { delimiter: ';' }
  )
  // BOM : Excel en français lit alors les accents correctement
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'modele-import-entreprises.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function CompaniesExport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exporter et modèle</CardTitle>
        <CardDescription>
          L&apos;export contient toutes vos entreprises, leur étape, leur score, leurs signaux en cours et leur
          contact principal. Les contacts qui se sont opposés à la prospection ne sont jamais exportés.
          Le fichier peut être réimporté tel quel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <a href="/api/export/companies" download>
            <Download className="w-4 h-4 mr-2" />
            Exporter mes entreprises
          </a>
        </Button>
        <Button variant="outline" onClick={downloadTemplate}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Télécharger le modèle
        </Button>
      </CardContent>
    </Card>
  )
}
