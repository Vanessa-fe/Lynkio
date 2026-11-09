'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertTriangle, ExternalLink, EyeOff, Loader2, Mail, Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { useStartLinkedin } from '@/components/linkedin/use-start-linkedin'
import { SearchPostsNowButton } from '@/components/linkedin/search-posts-now-button'
import { addLinkedinPost, dismissLinkedinPost } from '@/lib/actions/linkedin-posts'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { AddedLinkedinPost, LinkedinPostSearch, LinkedinPosts } from '@/lib/queries/linkedin-posts'
import type { LinkedinPost } from '@/types'

// L'extension passe chaque minute quand Chrome est ouvert : au-delà, elle est sans doute fermée
const ACTIVE_WITHIN_MS = 15 * 60 * 1000

const EMAIL_ORIGIN: Record<string, string> = {
  linkedin_post: 'écrit dans le post',
  hunter: 'trouvé par Hunter',
}

interface LinkedinPostsCardProps {
  posts: LinkedinPosts
  search: LinkedinPostSearch
}

/**
 * Posts LinkedIn « je cherche un freelance » trouvés par l'extension et triés par Sophie :
 * à ajouter ou ignorer, puis à qui répondre par e-mail ou par LinkedIn
 */
export function LinkedinPostsCard({ posts, search }: LinkedinPostsCardProps) {
  const now = search.readAt
  const ago = (iso: string) => formatDistance(new Date(iso), new Date(now), { addSuffix: true, locale: fr })
  const seenRecently = search.extensionSeenAt !== null && now - new Date(search.extensionSeenAt).getTime() < ACTIVE_WITHIN_MS

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkedinIcon className="w-5 h-5" />
          Posts LinkedIn
        </CardTitle>
        <CardDescription>
          Les missions freelance publiées sur LinkedIn, par l&apos;entreprise elle-même ou par un recruteur, une ESN
          ou une plateforme. L&apos;extension les trouve toutes les 2 heures. Sophie ne garde que les annonces en
          français, dans votre métier, et signale celles qui passent par un intermédiaire.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!search.enabled ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-dashed p-4">
            <p className="text-sm text-muted-foreground">
              La recherche de posts est désactivée. Choisissez vos mots-clés pour que l&apos;extension commence à chercher.
            </p>
            <Button size="sm" asChild>
              <Link href="/settings/extension">
                <Settings2 className="w-4 h-4 mr-2" />
                Activer la recherche
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-end">
              <SearchPostsNowButton />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {search.lastSearchAt
                  ? `Dernière recherche ${ago(search.lastSearchAt)}`
                  : 'Pas encore de recherche : elle se fera du lundi au vendredi, de 9 h à 18 h, Chrome ouvert'}
              </span>
              <span aria-hidden>·</span>
              {search.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary">
                  {keyword}
                </Badge>
              ))}
              <Link href="/settings/extension" className="underline hover:text-foreground">
                Modifier
              </Link>
            </div>
            {search.error && (
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{search.error}</span>
              </p>
            )}
            {!seenRecently && (
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {search.extensionSeenAt
                    ? `L'extension ne s'est pas manifestée ${ago(search.extensionSeenAt)} : Chrome est-il ouvert ?`
                    : 'L\'extension ne s\'est pas encore manifestée : installez-la et connectez-la dans les réglages.'}
                </span>
              </p>
            )}
          </div>
        )}

        {search.enabled && posts.toReview.length === 0 && posts.added.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun post à traiter pour l&apos;instant.</p>
        )}

        {posts.toReview.length > 0 && (
          <ul className="divide-y">
            {posts.toReview.map((post) => (
              <li key={post.id} className="py-4 first:pt-0 last:pb-0">
                <PostToReview post={post} ago={ago} />
              </li>
            ))}
          </ul>
        )}

        {posts.added.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Ajoutés cette semaine : à qui répondre</h3>
            <ul className="divide-y rounded-lg border">
              {posts.added.map((post) => (
                <li key={post.id} className="p-4">
                  <AddedPost post={post} ago={ago} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {posts.otherLanguage > 0 && (
          <p className="text-sm text-muted-foreground">
            {posts.otherLanguage} post{posts.otherLanguage > 1 ? 's' : ''} dans une autre langue ignoré
            {posts.otherLanguage > 1 ? 's' : ''} cette semaine : seules les annonces en français sont gardées.
          </p>
        )}

        {posts.filtered.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              {posts.filtered.length} post{posts.filtered.length > 1 ? 's' : ''} écarté
              {posts.filtered.length > 1 ? 's' : ''} par Sophie cette semaine
            </summary>
            <ul className="mt-3 divide-y rounded-lg border">
              {posts.filtered.map((post) => (
                <li key={post.id} className="p-4">
                  <FilteredPost post={post} ago={ago} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

function Author({ post, ago }: { post: LinkedinPost; ago: (iso: string) => string }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2">
        {post.author_linkedin_url ? (
          <a
            href={post.author_linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
          >
            {post.author_name}
          </a>
        ) : (
          <span className="font-medium">{post.author_name}</span>
        )}
        <span className="text-xs text-muted-foreground">{ago(post.posted_at ?? post.created_at)}</span>
      </div>
      {post.author_headline && <p className="text-sm text-muted-foreground line-clamp-1">{post.author_headline}</p>}
    </div>
  )
}

function PostLink({ post }: { post: LinkedinPost }) {
  return (
    <a
      href={post.post_url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm inline-flex items-center gap-1 hover:underline"
    >
      Voir sur LinkedIn
      <ExternalLink className="w-3 h-3" />
    </a>
  )
}

/** Ajouter ou ignorer : partagé par les posts à traiter et ceux écartés par Sophie */
function usePostActions(post: LinkedinPost) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState<'add' | 'dismiss' | null>(null)

  const add = async () => {
    setBusy('add')
    try {
      const result = await addLinkedinPost(post.id)
      if (!result.success || !result.data) {
        toast({ variant: 'destructive', title: 'Ajout impossible', description: result.error })
        return
      }
      const { email, emailNote } = result.data
      toast({
        title: `${post.author_name} est dans Filonea`,
        description: email ? `E-mail : ${email}` : (emailNote ?? 'Pas d\'e-mail trouvé : vous pouvez lui écrire sur LinkedIn.'),
      })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Ajout impossible', description: CONNECTION_ERROR })
    } finally {
      setBusy(null)
    }
  }

  const dismiss = async () => {
    setBusy('dismiss')
    try {
      const result = await dismissLinkedinPost(post.id)
      if (result.success) {
        router.refresh()
      } else {
        toast({ variant: 'destructive', title: 'Erreur', description: result.error })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: CONNECTION_ERROR })
    } finally {
      setBusy(null)
    }
  }

  return { add, dismiss, busy }
}

function PostToReview({ post, ago }: { post: LinkedinPost; ago: (iso: string) => string }) {
  const { add, dismiss, busy } = usePostActions(post)

  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <Author post={post} ago={ago} />
        {post.summary ? (
          <p className="font-medium">{post.summary}</p>
        ) : (
          <Badge variant="outline">Pas encore trié par Sophie</Badge>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground line-clamp-2 hover:text-foreground">
            {post.text}
          </summary>
          <p className="mt-2 text-sm whitespace-pre-line">{post.text}</p>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <PostLink post={post} />
          {!post.author_linkedin_url && <Badge variant="outline">Page entreprise</Badge>}
          {post.company_name && post.company_name !== post.author_name && (
            <Badge variant="secondary">{post.company_name}</Badge>
          )}
          {post.email && (
            <Badge variant="secondary">
              <Mail className="w-3 h-3 mr-1" />
              E-mail dans le post
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={add} disabled={busy !== null}>
          {busy === 'add' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Ajouter à Filonea
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy !== null}>
          <EyeOff className="w-4 h-4 mr-2" />
          Ignorer
        </Button>
      </div>
    </div>
  )
}

function AddedPost({ post, ago }: { post: AddedLinkedinPost; ago: (iso: string) => string }) {
  const { start, isStarting } = useStartLinkedin()
  const email = post.contact?.email ?? null
  const optedOut = !!post.contact?.opted_out_at

  return (
    <div className="space-y-3">
      <div className="min-w-0 space-y-1">
        <Author post={post} ago={ago} />
        {post.summary && <p className="text-sm">{post.summary}</p>}
        <p className="text-sm text-muted-foreground">
          {optedOut
            ? 'Cette personne ne souhaite plus être contactée.'
            : !post.contact_id
              ? 'Publié par la page de l\'entreprise : trouvez la bonne personne sur sa fiche.'
              : email
                ? `E-mail : ${email}${post.contact?.email_source && EMAIL_ORIGIN[post.contact.email_source] ? ` (${EMAIL_ORIGIN[post.contact.email_source]})` : ''}`
                : 'Pas d\'e-mail trouvé : répondez-lui sur LinkedIn, ou ajoutez son e-mail sur sa fiche.'}
        </p>
        <PostLink post={post} />
      </div>
      {!optedOut && (
        <div className="flex flex-wrap gap-2">
          {email && post.company_id && (
            <Button size="sm" asChild>
              <Link href={`/companies/${post.company_id}?redaction=email`}>
                <Mail className="w-4 h-4 mr-2" />
                Écrire un e-mail avec Sophie
              </Link>
            </Button>
          )}
          {post.contact_id && (
            <Button
              size="sm"
              variant={email ? 'outline' : 'default'}
              onClick={() => start({ contactIds: [post.contact_id!] })}
              disabled={isStarting}
            >
              {isStarting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkedinIcon className="w-4 h-4 mr-2" />}
              Envoyer sur LinkedIn
            </Button>
          )}
          {!email && post.company_id && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/companies/${post.company_id}`}>Voir la fiche</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function FilteredPost({ post, ago }: { post: LinkedinPost; ago: (iso: string) => string }) {
  const { add, busy } = usePostActions(post)

  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <Author post={post} ago={ago} />
        <p className="text-sm line-clamp-2">{post.summary ?? post.text}</p>
        {post.filter_reason && <p className="text-sm text-muted-foreground">{post.filter_reason}</p>}
        <PostLink post={post} />
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={add} disabled={busy !== null}>
        {busy === 'add' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
        Ajouter quand même
      </Button>
    </div>
  )
}
