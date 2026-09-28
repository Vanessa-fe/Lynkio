-- =====================================================================
-- SIGNAL « RECRUTE POUR LE WEB OU LE DIGITAL »
-- Une entreprise qui recrute un webmaster, un chargé de marketing digital,
-- un responsable e-commerce ou un chef de projet web investit dans son site,
-- souvent sans équipe de développement : un client direct pour une
-- développeuse freelance (refonte, application, outil interne), sans
-- réunions d'équipe ni régie.
-- =====================================================================

INSERT INTO signal_types (key, label, description, default_ttl_days) VALUES
  ('job_posting_digital', 'Recrute pour le web ou le digital',
   'Offre d''emploi de webmaster, marketing digital, e-commerce, chef de projet web ou référencement', 45)
ON CONFLICT (key) DO NOTHING;

INSERT INTO profession_signals (profession_key, signal_type, default_weight) VALUES
  ('web_developer', 'job_posting_digital', 30)
ON CONFLICT (profession_key, signal_type) DO NOTHING;
