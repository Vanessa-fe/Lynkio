'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Loader2, Pause, Plus, Power, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { saveLinkedinPostSearch } from '@/lib/actions/linkedin-posts'
import { MAX_POST_KEYWORDS } from '@/lib/validations/linkedin-posts'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { LinkedinPostSearch } from '@/lib/queries/linkedin-posts'

interface LinkedinPostSearchCardProps {
  search: LinkedinPostSearch
  // Proposés tant qu'aucun mot-clé n'est enregistré
  suggestions: string[]
}

/**
 * Recherche de posts « je cherche un freelance » par l'extension : l'interrupteur et les mots-clés
 */
export function LinkedinPostSearchCard({ search, suggestions }: LinkedinPostSearchCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [keywords, setKeywords] = useState<string[]>(search.keywords.length > 0 ? search.keywords : suggestions)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const full = keywords.length >= MAX_POST_KEYWORDS
  const unsaved = keywords.join('\n') !== search.keywords.join('\n')

  const addKeyword = () => {
    const keyword = draft.trim()
    if (!keyword || full) return
    if (!keywords.some((existing) => existing.toLocaleLowerCase('fr') === keyword.toLocaleLowerCase('fr'))) {
      setKeywords([...keywords, keyword])
    }
    setDraft('')
  }

  const save = async (enabled: boolean) => {
    setBusy(true)
    try {
      const result = await saveLinkedinPostSearch({ enabled, keywords })
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Enregistrement impossible', description: result.error })
        return
      }
      toast({
        title: enabled
          ? search.enabled
            ? 'Mots-clés enregistrés'
            : 'Recherche de posts activée'
          : 'Recherche de posts désactivée',
      })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Enregistrement impossible', description: CONNECTION_ERROR })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Search className="w-5 h-5" />
          Recherche de posts
          {search.enabled ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
          ) : (
            <Badge variant="secondary">Désactivée</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Toutes les 2 heures, du lundi au vendredi de 9 h à 18 h, l&apos;extension cherche les posts LinkedIn des
          dernières 24 heures qui contiennent vos mots-clés, comme vous le feriez à la main. Sophie les trie et vous les
          retrouvez dans Prospection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="post-keyword">
            Mots-clés ({keywords.length}/{MAX_POST_KEYWORDS})
          </Label>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="gap-1 pr-1 text-sm font-normal">
                {keyword}
                <button
                  type="button"
                  onClick={() => setKeywords(keywords.filter((existing) => existing !== keyword))}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label={`Retirer « ${keyword} »`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 max-w-md">
            <Input
              id="post-keyword"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addKeyword()
                }
              }}
              placeholder={full ? `${MAX_POST_KEYWORDS} mots-clés au plus` : 'Ex. : cherche un freelance Next.js'}
              maxLength={100}
              disabled={full}
            />
            <Button type="button" variant="outline" onClick={addKeyword} disabled={full || !draft.trim()}>
              <Plus className="w-4 h-4" />
              <span className="sr-only">Ajouter le mot-clé</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Préférez les mots de quelqu&apos;un qui cherche (« cherche un développeur freelance ») : « freelance » seul
            ramène surtout des freelances qui se présentent.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {search.enabled ? (
            <>
              <Button onClick={() => save(true)} disabled={busy || !unsaved}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer les mots-clés
              </Button>
              <Button variant="outline" onClick={() => save(false)} disabled={busy}>
                <Pause className="w-4 h-4 mr-2" />
                Désactiver
              </Button>
            </>
          ) : (
            <Button onClick={() => save(true)} disabled={busy || keywords.length === 0}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Power className="w-4 h-4 mr-2" />}
              Activer la recherche
            </Button>
          )}
        </div>

        {search.error && <p className="text-sm text-amber-700 dark:text-amber-400">{search.error}</p>}

        {search.lastSearchAt && (
          <p className="text-xs text-muted-foreground">
            Dernière recherche{' '}
            {formatDistance(new Date(search.lastSearchAt), new Date(search.readAt), { addSuffix: true, locale: fr })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
