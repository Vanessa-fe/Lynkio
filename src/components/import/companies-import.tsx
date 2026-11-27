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
import { SEGMENTS, segmentDescriptions, segmentLabels } from '@/lib/constants/segments'
import { ADDED_TODAY_PARAM } from '@/lib/constants/companies'
import type { CompanySegment } from '@/types'

type Step = 'upload' | 'preview' | 'done'

const NO_SOURCE = 'none'
const AUTO_SEGMENT = 'auto'
// Liste où ranger les personnes du fichier : aucune, une existante (son id), ou une nouvelle à nommer
const NO_LIST = 'none'
const NEW_LIST = 'new'

/** Liste qui porte déjà ce nom (même règle que la base : sans majuscules ni espaces autour) */
function listNamed(lists: ProspectListWithCount[], name: string) {
  const wanted = name.trim().toLowerCase()
  return wanted ? lists.find((list) => list.name.trim().toLowerCase() === wanted) : undefined
}
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
  const [listChoice, setListChoice] = useState<string>(NO_LIST)
  const [newListName, setNewListName] = useState('')
  const [segment, setSegment] = useState<string>(AUTO_SEGMENT)
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
        // Export Waalaxy : sa liste devient la liste Filonea proposée (l'existante du même nom, sinon une nouvelle)
        const waalaxyList = result.data.waalaxy?.list
        if (waalaxyList) {
          const existing = listNamed(lists, waalaxyList)
          setListChoice((current) => (current !== NO_LIST ? current : existing ? existing.id : NEW_LIST))
          if (!existing) setNewListName((current) => current || waalaxyList)
        }
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
      segment: segment === AUTO_SEGMENT ? null : (segment as CompanySegment),
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

  // Les listes rangent des personnes : sans contact dans le fichier, rien à y ranger
  const fileHasContacts = preview?.rows.some((row) => row.contact) ?? false
  const chosenList = lists.find((list) => list.id === listChoice)
  const sameNameList = listChoice === NEW_LIST ? listNamed(lists, newListName) : undefined
  const listName = !fileHasContacts ? '' : listChoice === NEW_LIST ? newListName : (chosenList?.name ?? '')

  // Nouvelles fiches et personnes qui rejoignent une fiche ; les personnes déjà suivies
  // comptent seulement si une liste est choisie (elles y sont rangées)
  const toImport = preview ? preview.ready + preview.attach : 0
  const withNews = preview?.rows.filter((row) => row.status === 'known' && row.activity && row.activity !== 'Rien de nouveau').length ?? 0
  const actionable = toImport + (preview && listName.trim() ? preview.known : withNews)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer des entreprises et des personnes</CardTitle>
        <CardDescription>Un CSV, une entreprise par ligne (avec un contact si besoin). Téléchargez le modèle plus bas pour les colonnes. Entreprise hors de France : remplissez sa colonne « Pays » (Belgique, Suisse…).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'upload' && (
          <div className="rounded-lg border-2 border-dashed p-8 text-center space-y-3">
            <FileUp className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Au plus {MAX_IMPORT_ROWS} lignes, rien n&apos;est importé sans votre accord.
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
                <p className="text-xs text-muted-foreground">déjà dans Filonea</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-destructive">{preview.invalid}</p>
                <p className="text-xs text-muted-foreground">en erreur</p>
              </div>
            </div>

            {preview.waalaxy && (
              <p className="text-sm rounded-md bg-primary/10 p-3">
                {preview.waalaxy.messages + preview.waalaxy.replies > 0 ? (
                  <>
                    Export d&apos;outil LinkedIn reconnu : {preview.waalaxy.messages} message{preview.waalaxy.messages > 1 ? 's' : ''}{' '}
                    envoyé{preview.waalaxy.messages > 1 ? 's' : ''} et {preview.waalaxy.replies} réponse
                    {preview.waalaxy.replies > 1 ? 's' : ''} seront notés dans l&apos;historique des personnes. Leur
                    statut et l&apos;étape de leur fiche suivront. Ce qui est déjà noté ne l&apos;est pas deux fois.
                  </>
                ) : (
                  <>Export d&apos;outil LinkedIn reconnu : aucun nouveau message ni nouvelle réponse, tout est déjà noté.</>
                )}
              </p>
            )}

            <div className="max-h-80 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Ligne</th>
                    <th className="p-2 font-medium">Entreprise</th>
                    <th className="p-2 font-medium hidden sm:table-cell">Contact</th>
                    {preview.waalaxy && <th className="p-2 font-medium hidden md:table-cell">Activité LinkedIn</th>}
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
                        {row.country && <span className="text-muted-foreground"> · {row.country}</span>}
                        {row.message && <p className="text-xs text-muted-foreground">{row.message}</p>}
                      </td>
                      <td className="p-2 hidden sm:table-cell">{row.contact ?? '–'}</td>
                      {preview.waalaxy && (
                        <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">{row.activity ?? '–'}</td>
                      )}
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
              <Label htmlFor="importSegment">Segment des nouvelles fiches</Label>
              <Select value={segment} onValueChange={setSegment} disabled={isWorking}>
                <SelectTrigger id="importSegment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_SEGMENT}>Deviné par Filonea</SelectItem>
                  {SEGMENTS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {segmentLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {segment === AUTO_SEGMENT
                  ? 'Filonea le devine d\'après le nom et le code d\'activité. Choisissez-le si tout le fichier est du même type, comme une liste d\'agences.'
                  : segmentDescriptions[segment as CompanySegment]}
              </p>
            </div>

            <div className="space-y-2 sm:max-w-sm">
              <Label htmlFor="importList">Ranger les personnes dans une liste (facultatif)</Label>
              {fileHasContacts ? (
                <>
                  <Select value={listChoice} onValueChange={setListChoice} disabled={isWorking}>
                    <SelectTrigger id="importList" className="w-full">
                      <SelectValue>
                        {listChoice === NEW_LIST ? 'Nouvelle liste' : (chosenList?.name ?? 'Pas de liste')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_LIST}>Pas de liste</SelectItem>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.count} personne{list.count > 1 ? 's' : ''})
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_LIST}>+ Nouvelle liste…</SelectItem>
                    </SelectContent>
                  </Select>
                  {listChoice === NEW_LIST && (
                    <Input
                      aria-label="Nom de la nouvelle liste"
                      autoComplete="off"
                      value={newListName}
                      onChange={(event) => setNewListName(event.target.value)}
                      placeholder="Nom de la nouvelle liste, par exemple : Bâtiment Belgique"
                      maxLength={100}
                      autoFocus
                      disabled={isWorking}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {listChoice !== NEW_LIST
                      ? 'Pratique pour retrouver ce fichier dans la page Personnes, ou l’exporter en CSV.'
                      : !newListName.trim()
                        ? 'Donnez-lui un nom : elle sera créée pendant l’import.'
                        : sameNameList
                          ? `La liste « ${sameNameList.name} » existe déjà : les personnes y seront ajoutées.`
                          : `La liste « ${newListName.trim()} » sera créée pendant l’import.`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ce fichier n’a pas de contact. Les listes rangent des personnes : il n’y a donc rien à y ranger. Ajoutez
                  des colonnes de contact (prénom, nom, e-mail…) pour en remplir une.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleImport} disabled={isWorking || actionable === 0}>
                {isWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {actionable === 0
                  ? 'Rien à importer'
                  : toImport === 0
                    ? listName.trim()
                      ? `Ranger ${preview.known} personne${preview.known > 1 ? 's' : ''} dans la liste`
                      : 'Mettre à jour les personnes'
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
            {result.waalaxy && (
              <p className="text-sm">
                Activité LinkedIn : {result.waalaxy.exchanges} échange{result.waalaxy.exchanges > 1 ? 's' : ''} noté
                {result.waalaxy.exchanges > 1 ? 's' : ''}
                {result.waalaxy.enriched > 0 &&
                  `, ${result.waalaxy.enriched} personne${result.waalaxy.enriched > 1 ? 's' : ''} complétée${result.waalaxy.enriched > 1 ? 's' : ''} (profil LinkedIn, e-mail, poste)`}
                {result.waalaxy.lost > 0 &&
                  `, ${result.waalaxy.lost} fiche${result.waalaxy.lost > 1 ? 's' : ''} classée${result.waalaxy.lost > 1 ? 's' : ''} non concrétisée${result.waalaxy.lost > 1 ? 's' : ''} (pas intéressé·e)`}
                .
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
                {/* Entreprises ouvertes sur les ajouts du jour, les plus récents d'abord */}
                <Link href={`/companies?vue=tableau&ajoutees=${ADDED_TODAY_PARAM}`}>
                  {result.imported > 0 ? 'Voir les entreprises ajoutées' : 'Voir les entreprises'}
                </Link>
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
