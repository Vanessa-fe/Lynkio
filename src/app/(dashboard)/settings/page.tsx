import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Palette, User, ChevronRight, Target, ListOrdered, MessageSquareText, Puzzle } from 'lucide-react'

const settingsCards = [
  {
    title: 'Client idéal',
    description: 'Tailles, signaux et mots-clés qui font le score des entreprises',
    icon: Target,
    href: '/settings/icp',
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
  },
  {
    title: 'Étapes et sources',
    description: 'Les étapes de votre pipeline et l\'origine de vos entreprises',
    icon: ListOrdered,
    href: '/settings/pipeline',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Messages de Sophie',
    description: 'Votre présentation et votre signature, pour les messages qu\'elle prépare',
    icon: MessageSquareText,
    href: '/settings/messages',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    title: 'Extension LinkedIn',
    description: 'Le bouton « + Filonea » sur les profils LinkedIn, et bientôt vos envois',
    icon: Puzzle,
    href: '/settings/extension',
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
  },
  {
    title: 'Thèmes',
    description: 'Personnaliser l\'apparence',
    icon: Palette,
    href: '#',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    badge: 'Utiliser le sélecteur',
  },
  {
    title: 'Profil',
    description: 'Gérer votre profil utilisateur',
    icon: User,
    href: '#',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    badge: 'Bientôt',
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground mt-2">
          Configurez votre compte et vos préférences
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsCards.map((card, index) => {
          const Icon = card.icon
          const isClickable = !card.badge || card.badge === 'Utiliser le sélecteur'

          const content = (
            <Card
              className={`hover-lift animate-slide-in-bottom relative overflow-hidden ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
              style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative z-10">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${card.bgColor}`}>
                      <Icon className={`w-6 h-6 ${card.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{card.title}</CardTitle>
                      <CardDescription className="mt-1">{card.description}</CardDescription>
                    </div>
                  </div>
                  {card.badge && (
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      {card.badge}
                    </span>
                  )}
                  {isClickable && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </div>
              </CardHeader>
            </Card>
          )

          return isClickable && card.href !== '#' ? (
            <Link key={card.title} href={card.href}>
              {content}
            </Link>
          ) : (
            <div key={card.title}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}
