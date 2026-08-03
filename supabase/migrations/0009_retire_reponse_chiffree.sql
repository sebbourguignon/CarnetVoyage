-- reponse_chiffree a été copiée (déchiffrée) dans quiz_reponses lors de la
-- migration 0008 — voir conversation pour le script ponctuel de
-- déchiffrement. Les 69 lignes de quiz_questions ont toutes leur pendant
-- dans quiz_reponses, vérifié avant cette migration : plus besoin de garder
-- deux sources de vérité pour la même donnée.

alter table quiz_questions drop column reponse_chiffree;
