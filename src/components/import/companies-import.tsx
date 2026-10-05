'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  importCompanies,
  previewCompaniesImport,
  type ImportPreview,
} from '@/lib/actions/company-import'
import { MAX_IMPORT_ROWS } from '@/lib/validations/company-import'
import { useToast } from '@/lib/hooks/use-toast'
import type { LeadSource } from '@/types'
import type { ProspectListWithCount } from '@/lib/queries/people'

type Step = 'upload' | 'preview' | 'done'

const NO_SOURCE = 'none'
const PREVIEW_LIMIT = 50

const statusBadges: Record<
  ImportPreview['rows'][number]['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  ready: { label: 'Nouvelle', variant: 'default' },
  attach: { label: 'Rejoint une fiche', variant: 'default' },
  known: { label: 'Déjà là', variant: 'secondary' },
  duplicate: { label: 'Doublon', variant: 'outline' },
  invalid: { label: 'Erreur', variant: 'destructive' },
}

export function CompaniesImport({ sources, lists }: { sources: LeadSource[]; lists: ProspectListWithCount[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [isWorking, setIsWorking] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [sourceId, setSourceId] = useState<string>(sources.find((source) => source.name === 'Autre')?.id ?? NO_SOURCE)
  const [listName, setListName] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof importCompanies>>['data'] | null>(null)

  const reset = () => {
    setStep('upload')
    setFileName(null)
    setRows([])
    setPreview(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = (file: File) => {
    if (!/\.csv$/i.test(file.name)) {
      toast({ variant: 'destructive', title: 'Fichier refusé', description: 'Choisissez un fichier .csv' })
      return
    }

    setIsWorking(true)
    setFileName(file.name)

    // Séparateur détecté automatiquement (« ; » d'Excel en français ou « , »)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: async (parsed) => {
        if (parsed.data.length === 0) {
          setIsWorking(false)
          toast({ variant: 'destructive', title: 'Fichier vide', description: 'Aucune ligne de données trouvée' })
          return
        }

        const result = await previewCompaniesImport(parsed.data)
        setIsWorking(false)

        if (!result.success || !result.data) {
          toast({ variant: 'destructive', title: 'Analyse impossible', description: result.error })
          return
        }

        setRows(parsed.data)
        setPreview(result.data)
        setStep('preview')
      },
      error: () => {
        setIsWorking(false)
        toast({ variant: 'destructive', title: 'Lecture impossible', description: 'Le fichier n\'a pas pu être lu' })
      },
    })
  }

  const handleImport = async () => {
    setIsWorking(true)
    const response = await importCompanies(rows, {
      sourceId: sourceId === NO_SOURCE ? null : sourceId,
      listName: listName.trim() || null,
    })
    setIsWorking(false)

    if (!response.success || !response.data) {
      toast({ variant: 'destructive', title: 'Import impossible', description: response.error })
      return
    }

    setResult(response.data)
    setStep('done')
    router.refresh()
  }

  // Nouvelles fiches et personnes qui rejoignent une fiche ; les personnes déjà suivies
  // comptent seulement si une liste est choisie (elles y sont rangées)
  const toImport = preview ? preview.ready + preview.attach : 0
  const actionable = toImport + (preview && listName.trim() ? preview.known : 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer des entreprises et des personnes</CardTitle>
        <CardDescription>
          Un fichier CSV avec une entreprise par ligne, et si besoin un contact. Colonnes reconnues : Nom (ou
          Entreprise, Société), Site web, SIREN ou SIRET, Ville, Code postal, Secteur, Taille, Source, Notes,
          Montant estimé, Prochaine action, Prénom, Nom du contact, Poste, E-mail, Téléphone, LinkedIn. Les autres
          colonnes sont ignorées. Une ligne sans entreprise mais avec le nom d&apos;une personne devient une
          personne seule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'upload' && (
          <div className="rounded-lg border-2 border-dashed p-8 text-center space-y-3">
            <FileUp className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Au plus {MAX_IMPORT_ROWS} lignes. Rien n&apos;est importé avant votre confirmation.
            </p>
            <input
              ref={inputRef}
              id="companiesCsv"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <Button asChild disabled={isWorking}>
              <label htmlFor="companiesCsv" className="cursor-pointer">
                {isWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isWorking ? 'Analyse du fichier…' : 'Choisir un fichier CSV'}
              </label>
            </Button>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{fileName}</strong> : {preview.total} ligne{preview.total > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-green-600">{preview.ready}</p>
                <p className="text-xs text-muted-foreground">nouvelles fiches</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-green-600">{preview.attach}</p>
                <p className="text-xs text-muted-foreground">rejoignent une fiche</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{preview.known + preview.duplicates}</p>
                <p className="text-xs text-muted-foreground">déjà dans Lynkio</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-destructive">{preview.invalid}</p>
                <p className="text-xs text-muted-foreground">en erreur</p>
              </div>
            </div>

            <div className="max-h-80 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Ligne</th>
                    <th className="p-2 font-medium">Entreprise</th>
                    <th className="p-2 font-medium hidden sm:table-cell">Contact</th>
                    <th className="p-2 font-medium">État</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, PREVIEW_LIMIT).map((row) => (
                    <tr key={row.line} className="border-t align-top">
                      <td className="p-2 tabular-nums text-muted-foreground">{row.line}</td>
                      <td className="p-2">
                        <span className="font-medium">{row.name}</span>
                        {row.city && <span className="text-muted-foreground"> · {row.city}</span>}
                        {row.message && <p className="text-xs text-muted-foreground">{row.message}</p>}
                      </td>
                      <td className="p-2 hidden sm:table-cell">{row.contact ?? '–'}</td>
                      <td className="p-2">
                        <Badge variant={statusBadges[row.status].variant}>{statusBadges[row.status].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > PREVIEW_LIMIT && (
              <p className="text-xs text-muted-foreground">
                Aperçu des {PREVIEW_LIMIT} premières lignes sur {preview.rows.length}.
              </p>
            )}

            <div className="space-y-2 sm:max-w-sm">
              <Label htmlFor="importSource">Source des entreprises</Label>
              <Select value={sourceId} onValueChange={setSourceId} disabled={isWorking}>
                <SelectTrigger id="importSource">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SOURCE}>Aucune</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Utilisée quand la ligne n&apos;indique pas une de vos sources dans sa colonne « Source ».
              </p>
            </div>

            <div className="space-y-2 sm:max-w-sm">
              <Label htmlFor="importList">Ranger les personnes dans une liste (facultatif)</Label>
              <Input
                id="importList"
                list="import-list-options"
                autoComplete="off"
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                placeholder="Une liste existante, ou le nom d'une nouvelle"
                maxLength={100}
                disabled={isWorking}
              />
              <datalist id="import-list-options">
                {lists.map((list) => (
                  <option key={list.id} value={list.name} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Pratique pour retrouver ce fichier dans la page Personnes, ou l&apos;exporter vers Waalaxy.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleImport} disabled={isWorking || actionable === 0}>
                {isWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {actionable === 0
                  ? 'Rien à importer'
                  : toImport === 0
                    ? `Ranger ${preview.known} personne${preview.known > 1 ? 's' : ''} dans la liste`
                    : `Importer ${toImport} ligne${toImport > 1 ? 's' : ''}`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={isWorking}>
                Choisir un autre fichier
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
              {result.imported} fiche{result.imported > 1 ? 's' : ''} créée{result.imported > 1 ? 's' : ''},{' '}
              {result.contacts} personne{result.contacts > 1 ? 's' : ''} ajoutée{result.contacts > 1 ? 's' : ''}.
            </p>
            {result.skippedContacts > 0 && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                {result.skippedContacts} contact{result.skippedContacts > 1 ? 's' : ''} non importé
                {result.skippedContacts > 1 ? 's' : ''} : leur e-mail est déjà utilisé par un autre contact.
              </p>
            )}
            {result.list && (
              <p className="text-sm">
                {result.list.added} personne{result.list.added > 1 ? 's' : ''} rangée{result.list.added > 1 ? 's' : ''}{' '}
                dans la liste{' '}
                <Link href={`/people?list=${result.list.id}`} className="underline font-medium">
                  « {result.list.name} »
                </Link>
                .
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Elles sont dans la première étape de votre pipeline, avec leur score déjà calculé.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/companies">Voir les entreprises</Link>
              </Button>
              <Button variant="outline" onClick={reset}>
                <FileUp className="w-4 h-4 mr-2" />
                Importer un autre fichier
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
