-- Généré par scripts/import-sheet.ts (--backfill) ; ne pas modifier à la main.
-- Corporations détruites dont les colonnes avaient été supprimées du tableur, retrouvées dans
-- son historique des versions. À exécuter une fois, après 20261117000000_fiches_vies.sql, sur
-- une base déjà remplie. Tout ou rien : une erreur annule l'ensemble.
do $$
declare
  v_profile bigint;
  v_company bigint;
  v_count integer;
begin

  -- SMI Hardgun's : 199 relevés du 2024-03-04 au 2026-10-14, fermée le 2026-11-11.
  if exists (select 1 from public.companies where name = 'SMI Hardgun''s' and closed_on = '2026-11-11') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'SMI Hardgun''s', '2026-11-11';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'SMI Hardgun''s' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'SMI Hardgun''s' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-10-14'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'SMI Hardgun''s', '2024-03-04', '2026-10-14';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('SMI Hardgun''s', '{}'::text[], v_profile, '2026-11-11', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 15017::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 14992::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 14968::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 14943::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 14918::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 14894::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 14870::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 14845::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 14821::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 14773::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 14749::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 14725::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 14701::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 14677::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 14654::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 14630::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 14607::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 14583::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 14560::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 14537::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 14513::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 14490::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 14467::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 14444::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 14421::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 14398::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 14376::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 14353::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 14330::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 14308::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 14285::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 14263::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 14240::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 14196::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 14174::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 14152::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 14130::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 14108::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 14086::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 14064::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 14042::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 14021::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 13999::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 13977::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 13967::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 14073::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 14051::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 14008::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 13987::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 13966::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 13944::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 13923::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 13881::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 13860::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 13624::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 13544::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 13406::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 12817::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 12767::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 12699::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 12582::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 12533::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 12500::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 12448::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 12496::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 12520::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 12504::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 12457::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 12439::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 12424::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 12409::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 12362::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 12486::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 12455::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 12428::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 12434::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 12394::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 12475::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 12422::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 12349::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 12511::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 12330::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 12316::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 12474::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 12466::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 12432::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 12409::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 12408::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 12368::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 12341::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 12314::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 12287::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 12261::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 12142::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 11988::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 11963::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 11950::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 11925::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 11875::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 11850::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 11776::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 11643::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 11595::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 11560::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 11548::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 11490::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 11420::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 11386::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 11329::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 11317::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 11284::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 11183::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 11234::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 11214::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 11197::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 11290::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 11300::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 11335::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 11382::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 11385::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 11429::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 11550::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 11593::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 11663::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 11688::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 11667::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 11657::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 11646::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 11626::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 11615::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 11598::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 11598::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 11588::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 11578::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 11590::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 11579::bigint, 806312::bigint, 2::integer),
    ('2025-08-16'::date, 11569::bigint, 805912::bigint, 2::integer),
    ('2025-08-17'::date, 11559::bigint, 800912::bigint, 2::integer),
    ('2025-08-18'::date, 11549::bigint, 794912::bigint, 2::integer),
    ('2025-08-19'::date, 11539::bigint, 789912::bigint, 2::integer),
    ('2025-08-20'::date, 11529::bigint, 833352::bigint, 2::integer),
    ('2025-08-21'::date, 11562::bigint, 756312::bigint, 2::integer),
    ('2025-08-22'::date, 11552::bigint, 751312::bigint, 2::integer),
    ('2025-08-23'::date, 11542::bigint, 676672::bigint, 2::integer),
    ('2025-08-24'::date, 11532::bigint, 677592::bigint, 2::integer),
    ('2025-08-25'::date, 11522::bigint, 671312::bigint, 2::integer),
    ('2025-08-26'::date, 11577::bigint, 742482::bigint, 2::integer),
    ('2025-08-27'::date, 11663::bigint, 846312::bigint, 2::integer),
    ('2025-08-29'::date, 11662::bigint, 1638662::bigint, 2::integer),
    ('2025-08-30'::date, 11652::bigint, 1563662::bigint, 2::integer),
    ('2025-09-01'::date, 11670::bigint, 1597158::bigint, 2::integer),
    ('2025-09-07'::date, 11637::bigint, 1539158::bigint, 1::integer),
    ('2025-09-11'::date, 11597::bigint, 1539158::bigint, 1::integer),
    ('2025-09-12'::date, 11622::bigint, 1574758::bigint, 2::integer),
    ('2025-09-13'::date, 11633::bigint, 1524458::bigint, 2::integer),
    ('2025-09-21'::date, 11610::bigint, 1514158::bigint, 2::integer),
    ('2025-09-25'::date, 11592::bigint, 1514158::bigint, 2::integer),
    ('2025-10-01'::date, 11552::bigint, 1464208::bigint, 2::integer),
    ('2025-10-09'::date, 11494::bigint, 1417208::bigint, 2::integer),
    ('2025-10-14'::date, 11565::bigint, 1379928::bigint, 2::integer),
    ('2025-10-22'::date, 11824::bigint, 1131308::bigint, 2::integer),
    ('2025-10-24'::date, 11809::bigint, 1132358::bigint, 2::integer),
    ('2025-10-25'::date, 11799::bigint, 1062358::bigint, 2::integer),
    ('2025-11-02'::date, 12150::bigint, 1582306::bigint, 1::integer),
    ('2025-11-10'::date, 12176::bigint, 1711631::bigint, 1::integer),
    ('2025-12-03'::date, 13696::bigint, 1675699::bigint, 1::integer),
    ('2025-12-10'::date, 13722::bigint, 1755949::bigint, 1::integer),
    ('2025-12-18'::date, 13643::bigint, 1766349::bigint, 1::integer),
    ('2025-12-19'::date, 13632::bigint, 1766349::bigint, 1::integer),
    ('2026-01-31'::date, 13230::bigint, 1828489::bigint, 1::integer),
    ('2026-02-19'::date, 13040::bigint, 1828489::bigint, 1::integer),
    ('2026-02-22'::date, 13010::bigint, 1506409::bigint, 1::integer),
    ('2026-02-26'::date, 12979::bigint, 1828489::bigint, 1::integer),
    ('2026-03-01'::date, 12950::bigint, 1516809::bigint, 1::integer),
    ('2026-03-13'::date, 12872::bigint, 1567299::bigint, 1::integer),
    ('2026-03-14'::date, 12862::bigint, 1567299::bigint, 1::integer),
    ('2026-03-19'::date, 12817::bigint, 1561259::bigint, 1::integer),
    ('2026-03-24'::date, 12770::bigint, 1561259::bigint, 1::integer),
    ('2026-03-28'::date, 12732::bigint, 1561259::bigint, 1::integer),
    ('2026-03-30'::date, 12714::bigint, 1561259::bigint, 1::integer),
    ('2026-03-31'::date, 12704::bigint, 1561259::bigint, 1::integer),
    ('2026-04-02'::date, 12686::bigint, 1561259::bigint, 1::integer),
    ('2026-04-06'::date, 12649::bigint, 1561259::bigint, 1::integer),
    ('2026-04-09'::date, 12621::bigint, 1561259::bigint, 1::integer),
    ('2026-04-17'::date, 12548::bigint, 1561259::bigint, 1::integer),
    ('2026-04-20'::date, 12521::bigint, 1565763::bigint, 2::integer),
    ('2026-04-27'::date, 12578::bigint, 1689313::bigint, 2::integer),
    ('2026-05-05'::date, 12559::bigint, 1722685::bigint, 2::integer),
    ('2026-05-07'::date, 12541::bigint, 1712685::bigint, 2::integer),
    ('2026-05-22'::date, 12835::bigint, 5000::bigint, 0::integer),
    ('2026-06-21'::date, 12577::bigint, 5000::bigint, 0::integer),
    ('2026-07-01'::date, 12482::bigint, 5000::bigint, 0::integer),
    ('2026-08-20'::date, 12067::bigint, 5000::bigint, 0::integer),
    ('2026-09-19'::date, 11831::bigint, 5000::bigint, 0::integer),
    ('2026-09-26'::date, 11777::bigint, 5000::bigint, 0::integer),
    ('2026-10-08'::date, 11686::bigint, 5000::bigint, 0::integer),
    ('2026-10-11'::date, 11664::bigint, 5000::bigint, 0::integer),
    ('2026-10-12'::date, 11656::bigint, 5000::bigint, 0::integer),
    ('2026-10-14'::date, 11641::bigint, 5000::bigint, 0::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 199 then
    raise exception '« % » : % relevés trouvés sur 199', 'SMI Hardgun''s', v_count;
  end if;

  -- Armacham Bullets : 197 relevés du 2024-03-04 au 2026-10-11, fermée le 2026-10-12.
  if exists (select 1 from public.companies where name = 'Armacham Bullets' and closed_on = '2026-10-12') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Armacham Bullets', '2026-10-12';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Armacham Bullets' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Armacham Bullets' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-10-11'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Armacham Bullets', '2024-03-04', '2026-10-11';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Armacham Bullets', '{}'::text[], v_profile, '2026-10-12', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 61670::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 61663::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 61649::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 61634::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 61665::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 61679::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 61665::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 61651::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 61659::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 61631::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 61617::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 61602::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 61603::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 61596::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 61582::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 61568::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 61574::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 61562::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 61548::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 61534::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 61522::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 61508::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 61496::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 61482::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 61468::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 61459::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 61446::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 61431::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 61417::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 61403::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 61413::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 61398::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 61408::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 61381::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 61379::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 61379::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 61364::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 61350::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 61336::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 61322::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 61308::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 61293::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 61279::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 61267::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 61239::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 61233::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 61220::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 61192::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 61185::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 61170::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 61160::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 61155::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 61132::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 61121::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 60987::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 60947::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 60906::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 60331::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 60172::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 60146::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 60047::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 60015::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 60001::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 59881::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 59852::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 59813::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 59800::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 59766::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 59755::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 59749::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 59735::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 59702::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 59671::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 59652::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 59669::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 59661::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 59640::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 59539::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 59489::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 59436::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 59282::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 59133::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 59120::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 59086::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 59047::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 58918::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 58904::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 58891::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 58875::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 58856::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 58837::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 58829::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 58803::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 58719::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 58728::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 58742::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 58739::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 58714::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 58699::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 58684::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 58724::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 58864::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 58865::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 58867::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 58875::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 58870::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 58818::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 58788::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 58787::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 58775::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 58762::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 58689::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 58660::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 58471::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 58473::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 58453::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 58512::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 58492::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 58691::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 58699::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 58695::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 58616::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 58618::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 58606::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 58598::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 58595::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 58603::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 58593::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 58670::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 58672::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 58654::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 58658::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 58691::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 58678::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 58677::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 58668::bigint, 3935881::bigint, 3::integer),
    ('2025-08-16'::date, 58656::bigint, 3935881::bigint, 3::integer),
    ('2025-08-17'::date, 58649::bigint, 3961081::bigint, 3::integer),
    ('2025-08-18'::date, 58637::bigint, 3961081::bigint, 3::integer),
    ('2025-08-19'::date, 58625::bigint, 3988441::bigint, 3::integer),
    ('2025-08-20'::date, 58623::bigint, 3496241::bigint, 3::integer),
    ('2025-08-21'::date, 58622::bigint, 3504731::bigint, 3::integer),
    ('2025-08-22'::date, 58617::bigint, 3536591::bigint, 3::integer),
    ('2025-08-23'::date, 58633::bigint, 3646031::bigint, 3::integer),
    ('2025-08-24'::date, 58673::bigint, 3667091::bigint, 3::integer),
    ('2025-08-25'::date, 58667::bigint, 3690511::bigint, 3::integer),
    ('2025-08-26'::date, 58655::bigint, 3690511::bigint, 3::integer),
    ('2025-08-27'::date, 58681::bigint, 3013231::bigint, 3::integer),
    ('2025-08-29'::date, 58657::bigint, 3017411::bigint, 3::integer),
    ('2025-08-30'::date, 58646::bigint, 3018851::bigint, 1::integer),
    ('2025-09-01'::date, 58628::bigint, 3049871::bigint, 1::integer),
    ('2025-09-07'::date, 58580::bigint, 2910871::bigint, 1::integer),
    ('2025-09-11'::date, 58560::bigint, 3046221::bigint, 1::integer),
    ('2025-09-12'::date, 58553::bigint, 3072621::bigint, 1::integer),
    ('2025-09-13'::date, 58547::bigint, 3095381::bigint, 2::integer),
    ('2025-09-21'::date, 58517::bigint, 3217395::bigint, 4::integer),
    ('2025-09-25'::date, 58539::bigint, 3446289::bigint, 5::integer),
    ('2025-10-01'::date, 58491::bigint, 3300969::bigint, 4::integer),
    ('2025-10-09'::date, 58429::bigint, 3299191::bigint, 4::integer),
    ('2025-10-14'::date, 58397::bigint, 3308613::bigint, 5::integer),
    ('2025-10-22'::date, 58941::bigint, 5993600::bigint, 3::integer),
    ('2025-10-24'::date, 58929::bigint, 5709047::bigint, 3::integer),
    ('2025-10-25'::date, 58917::bigint, 5700247::bigint, 3::integer),
    ('2025-11-02'::date, 58902::bigint, 6030373::bigint, 3::integer),
    ('2025-11-10'::date, 58898::bigint, 5066555::bigint, 3::integer),
    ('2025-12-03'::date, 58914::bigint, 5111308::bigint, 3::integer),
    ('2025-12-10'::date, 58893::bigint, 5004096::bigint, 2::integer),
    ('2025-12-18'::date, 58989::bigint, 3807482::bigint, 3::integer),
    ('2025-12-19'::date, 58985::bigint, 3829695::bigint, 3::integer),
    ('2026-01-31'::date, 58863::bigint, 988580::bigint, 3::integer),
    ('2026-02-19'::date, 58742::bigint, 1560907::bigint, 3::integer),
    ('2026-02-22'::date, 58754::bigint, 1494244::bigint, 3::integer),
    ('2026-02-26'::date, 58727::bigint, 988580::bigint, 4::integer),
    ('2026-03-01'::date, 58731::bigint, 1798409::bigint, 4::integer),
    ('2026-03-13'::date, 58789::bigint, 2477558::bigint, 4::integer),
    ('2026-03-14'::date, 58779::bigint, 2466758::bigint, 4::integer),
    ('2026-03-19'::date, 58731::bigint, 1827514::bigint, 4::integer),
    ('2026-03-24'::date, 58705::bigint, 1528409::bigint, 4::integer),
    ('2026-03-28'::date, 58815::bigint, 2127212::bigint, 4::integer),
    ('2026-03-30'::date, 58897::bigint, 1858725::bigint, 4::integer),
    ('2026-03-31'::date, 58924::bigint, 2029521::bigint, 4::integer),
    ('2026-04-02'::date, 58970::bigint, 1625642::bigint, 4::integer),
    ('2026-04-06'::date, 59070::bigint, 1685398::bigint, 5::integer),
    ('2026-04-09'::date, 59138::bigint, 1383419::bigint, 2::integer),
    ('2026-04-17'::date, 59119::bigint, 14106897::bigint, 3::integer),
    ('2026-04-20'::date, 59186::bigint, 14438483::bigint, 3::integer),
    ('2026-04-27'::date, 59206::bigint, 13368448::bigint, 2::integer),
    ('2026-05-05'::date, 59224::bigint, 12718840::bigint, 3::integer),
    ('2026-05-07'::date, 59315::bigint, 13345348::bigint, 3::integer),
    ('2026-05-22'::date, 59556::bigint, 13078684::bigint, 4::integer),
    ('2026-06-21'::date, 60012::bigint, 12402450::bigint, 3::integer),
    ('2026-07-01'::date, 60147::bigint, 10510436::bigint, 2::integer),
    ('2026-08-20'::date, 60132::bigint, 9229614::bigint, 2::integer),
    ('2026-09-19'::date, 60312::bigint, 8143368::bigint, 1::integer),
    ('2026-09-26'::date, 60231::bigint, 8143368::bigint, 1::integer),
    ('2026-10-08'::date, 60093::bigint, 8143368::bigint, 0::integer),
    ('2026-10-11'::date, 60058::bigint, 8143368::bigint, 0::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 197 then
    raise exception '« % » : % relevés trouvés sur 197', 'Armacham Bullets', v_count;
  end if;

  -- Armacham Financial : 196 relevés du 2024-03-04 au 2026-10-08, fermée le 2026-10-11.
  if exists (select 1 from public.companies where name = 'Armacham Financial' and closed_on = '2026-10-11') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Armacham Financial', '2026-10-11';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Armacham Financial' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Armacham Financial' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-10-08'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Armacham Financial', '2024-03-04', '2026-10-08';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Armacham Financial', '{}'::text[], v_profile, '2026-10-11', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 284498::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 284439::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 284381::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 284323::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 284264::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 284206::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 284148::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 284090::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 284032::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 283915::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 283857::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 283799::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 283741::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 283683::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 283625::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 283568::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 283510::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 283452::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 283394::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 283337::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 283279::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 283221::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 283164::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 283106::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 283048::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 282990::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 282933::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 282875::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 282818::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 282760::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 282702::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 282645::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 282587::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 282472::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 282414::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 282357::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 282299::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 282242::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 282318::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 282261::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 282203::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 282146::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 282089::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 282031::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 281917::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 281860::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 281803::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 281689::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 281631::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 281574::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 281517::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 281461::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 281346::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 281289::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 280552::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 280326::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 279931::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 277275::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 276340::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 276148::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 275449::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 275300::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 275191::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 274497::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 274233::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 274072::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 274018::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 273860::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 273752::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 273698::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 273645::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 273484::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 273323::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 273216::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 273108::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 273001::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 272841::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 272146::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 271933::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 271667::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 270610::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 269531::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 269479::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 269012::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 268856::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 268241::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 268137::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 268088::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 267933::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 267829::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 267726::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 267623::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 267521::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 267772::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 267732::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 267631::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 267579::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 267477::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 267272::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 267170::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 266908::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 266349::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 266274::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 266122::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 266072::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 265820::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 265530::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 265380::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 265130::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 265080::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 264929::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 264643::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 264395::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 263307::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 263110::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 262567::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 262469::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 262370::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 260592::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 260543::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 260495::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 259967::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 259871::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 259678::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 259583::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 259486::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 259439::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 259391::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 259295::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 259247::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 259151::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 259056::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 259008::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 258960::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 258912::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 258864::bigint, 323344942::bigint, 6::integer),
    ('2025-08-16'::date, 258817::bigint, 323337694::bigint, 5::integer),
    ('2025-08-17'::date, 258769::bigint, 323339398::bigint, 5::integer),
    ('2025-08-18'::date, 258722::bigint, 323340385::bigint, 5::integer),
    ('2025-08-19'::date, 258674::bigint, 323340374::bigint, 5::integer),
    ('2025-08-20'::date, 258626::bigint, 323340561::bigint, 5::integer),
    ('2025-08-21'::date, 258578::bigint, 323340538::bigint, 5::integer),
    ('2025-08-22'::date, 258530::bigint, 323340534::bigint, 5::integer),
    ('2025-08-23'::date, 258482::bigint, 323340500::bigint, 5::integer),
    ('2025-08-24'::date, 258435::bigint, 323340461::bigint, 5::integer),
    ('2025-08-25'::date, 258387::bigint, 323340437::bigint, 5::integer),
    ('2025-08-26'::date, 258339::bigint, 323340523::bigint, 5::integer),
    ('2025-08-27'::date, 258293::bigint, 323347259::bigint, 4::integer),
    ('2025-08-29'::date, 258197::bigint, 323347507::bigint, 4::integer),
    ('2025-08-30'::date, 258150::bigint, 323347480::bigint, 4::integer),
    ('2025-09-01'::date, 258054::bigint, 323347411::bigint, 4::integer),
    ('2025-09-07'::date, 257772::bigint, 323363392::bigint, 4::integer),
    ('2025-09-11'::date, 257582::bigint, 323363204::bigint, 5::integer),
    ('2025-09-12'::date, 257535::bigint, 323363244::bigint, 3::integer),
    ('2025-09-13'::date, 257487::bigint, 323363226::bigint, 3::integer),
    ('2025-09-21'::date, 257108::bigint, 323363980::bigint, 4::integer),
    ('2025-09-25'::date, 256920::bigint, 323364934::bigint, 3::integer),
    ('2025-10-01'::date, 256638::bigint, 323371266::bigint, 4::integer),
    ('2025-10-09'::date, 256269::bigint, 323415571::bigint, 4::integer),
    ('2025-10-14'::date, 256037::bigint, 323426976::bigint, 5::integer),
    ('2025-10-22'::date, 255663::bigint, 323430302::bigint, 5::integer),
    ('2025-10-24'::date, 255587::bigint, 323523002::bigint, 7::integer),
    ('2025-10-25'::date, 255540::bigint, 323522002::bigint, 7::integer),
    ('2025-11-02'::date, 255167::bigint, 323521935::bigint, 5::integer),
    ('2025-11-10'::date, 254796::bigint, 323521835::bigint, 6::integer),
    ('2025-12-03'::date, 253735::bigint, 323538723::bigint, 5::integer),
    ('2025-12-10'::date, 253414::bigint, 323543599::bigint, 5::integer),
    ('2025-12-18'::date, 253048::bigint, 323545681::bigint, 4::integer),
    ('2025-12-19'::date, 253002::bigint, 323545681::bigint, 5::integer),
    ('2026-01-31'::date, 251054::bigint, 323575027::bigint, 5::integer),
    ('2026-02-19'::date, 250202::bigint, 323583981::bigint, 5::integer),
    ('2026-02-22'::date, 250068::bigint, 323584722::bigint, 5::integer),
    ('2026-02-26'::date, 249889::bigint, 323575027::bigint, 5::integer),
    ('2026-03-01'::date, 249756::bigint, 323589154::bigint, 5::integer),
    ('2026-03-13'::date, 249222::bigint, 323592673::bigint, 6::integer),
    ('2026-03-14'::date, 249178::bigint, 323592673::bigint, 6::integer),
    ('2026-03-19'::date, 248957::bigint, 323599273::bigint, 6::integer),
    ('2026-03-24'::date, 248737::bigint, 318752711::bigint, 1::integer),
    ('2026-03-28'::date, 248560::bigint, 318752711::bigint, 1::integer),
    ('2026-03-30'::date, 248472::bigint, 318752711::bigint, 1::integer),
    ('2026-03-31'::date, 248428::bigint, 313971421::bigint, 1::integer),
    ('2026-04-02'::date, 248339::bigint, 309261850::bigint, 1::integer),
    ('2026-04-06'::date, 248163::bigint, 309261850::bigint, 1::integer),
    ('2026-04-09'::date, 248031::bigint, 299809881::bigint, 1::integer),
    ('2026-04-17'::date, 248193::bigint, 26206668::bigint, 3::integer),
    ('2026-04-20'::date, 248169::bigint, 26821077::bigint, 3::integer),
    ('2026-04-27'::date, 247864::bigint, 26828482::bigint, 3::integer),
    ('2026-05-05'::date, 247515::bigint, 26817626::bigint, 4::integer),
    ('2026-05-07'::date, 247429::bigint, 26826048::bigint, 5::integer),
    ('2026-05-22'::date, 246885::bigint, 27341567::bigint, 4::integer),
    ('2026-06-21'::date, 246176::bigint, 10251298::bigint, 6::integer),
    ('2026-07-01'::date, 245806::bigint, 10763342::bigint, 6::integer),
    ('2026-08-20'::date, 243784::bigint, 11037428::bigint, 6::integer),
    ('2026-09-19'::date, 242734::bigint, 12046331::bigint, 6::integer),
    ('2026-09-26'::date, 242443::bigint, 12007557::bigint, 5::integer),
    ('2026-10-08'::date, 242103::bigint, 12857951::bigint, 5::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 196 then
    raise exception '« % » : % relevés trouvés sur 196', 'Armacham Financial', v_count;
  end if;

  -- Kob Koncept : 193 relevés du 2024-03-04 au 2026-08-20, fermée le 2026-09-19.
  if exists (select 1 from public.companies where name = 'Kob Koncept' and closed_on = '2026-09-19') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Kob Koncept', '2026-09-19';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Kob Koncept' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Kob Koncept' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-08-20'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Kob Koncept', '2024-03-04', '2026-08-20';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Kob Koncept', '{}'::text[], v_profile, '2026-09-19', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 6586::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 6583::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 6580::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 6577::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 6573::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 6570::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 6567::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 6564::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 6561::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 6554::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 6551::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 6549::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 6545::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 6542::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 6539::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 6536::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 6533::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 6530::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 6527::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 6524::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 6520::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 6517::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 6514::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 6511::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 6508::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 6505::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 6502::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 6499::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 6496::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 6492::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 6489::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 6486::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 6483::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 6477::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 6474::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 6471::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 6468::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 6465::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 6462::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 6459::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 6456::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 6452::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 6449::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 6446::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 6440::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 6437::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 6434::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 6428::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 6425::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 6422::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 6419::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 6416::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 6410::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 6407::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 6368::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 6356::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 6335::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 6191::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 6144::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 6133::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 6097::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 6089::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 6084::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 6048::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 6035::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 6027::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 6024::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 6016::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 6011::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 6008::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 6006::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 5999::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 5991::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 5986::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 5980::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 5975::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 5967::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 5933::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 5923::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 5910::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 5862::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 5805::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 5802::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 5781::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 5773::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 5744::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 5739::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 5737::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 5730::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 5725::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 5720::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 5715::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 5711::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 5689::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 5661::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 5656::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 5654::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 5649::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 5640::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 5635::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 5621::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 5596::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 5587::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 5580::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 5577::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 5566::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 5552::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 5546::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 5534::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 5532::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 5525::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 5505::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 5494::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 5446::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 5437::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 5413::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 5409::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 5405::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 5323::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 5321::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 5318::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 5296::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 5292::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 5283::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 5279::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 5275::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 5273::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 5271::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 5267::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 5265::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 5261::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 5257::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 5255::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 5253::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 5251::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 5249::bigint, 1721825::bigint, 1::integer),
    ('2025-08-16'::date, 5247::bigint, 1721825::bigint, 1::integer),
    ('2025-08-17'::date, 5245::bigint, 1721825::bigint, 1::integer),
    ('2025-08-18'::date, 5243::bigint, 1721825::bigint, 1::integer),
    ('2025-08-19'::date, 5241::bigint, 1721825::bigint, 1::integer),
    ('2025-08-20'::date, 5239::bigint, 1721825::bigint, 1::integer),
    ('2025-08-21'::date, 5237::bigint, 1721825::bigint, 1::integer),
    ('2025-08-22'::date, 5235::bigint, 1721825::bigint, 1::integer),
    ('2025-08-23'::date, 5233::bigint, 1721825::bigint, 1::integer),
    ('2025-08-24'::date, 5231::bigint, 1721825::bigint, 1::integer),
    ('2025-08-25'::date, 5229::bigint, 1721825::bigint, 1::integer),
    ('2025-08-26'::date, 5227::bigint, 1721825::bigint, 1::integer),
    ('2025-08-27'::date, 5225::bigint, 1721825::bigint, 1::integer),
    ('2025-08-29'::date, 5221::bigint, 1721825::bigint, 1::integer),
    ('2025-08-30'::date, 5219::bigint, 1721825::bigint, 1::integer),
    ('2025-09-01'::date, 5215::bigint, 1721825::bigint, 1::integer),
    ('2025-09-07'::date, 5203::bigint, 1721825::bigint, 1::integer),
    ('2025-09-11'::date, 5195::bigint, 1721825::bigint, 1::integer),
    ('2025-09-12'::date, 5193::bigint, 1721825::bigint, 1::integer),
    ('2025-09-13'::date, 5191::bigint, 1721825::bigint, 1::integer),
    ('2025-09-21'::date, 5175::bigint, 1721825::bigint, 1::integer),
    ('2025-09-25'::date, 5167::bigint, 1721825::bigint, 1::integer),
    ('2025-10-01'::date, 5156::bigint, 1721825::bigint, 1::integer),
    ('2025-10-09'::date, 5140::bigint, 1721825::bigint, 1::integer),
    ('2025-10-14'::date, 5130::bigint, 1721826::bigint, 1::integer),
    ('2025-10-22'::date, 5115::bigint, 1721826::bigint, 1::integer),
    ('2025-10-24'::date, 5111::bigint, 1721826::bigint, 1::integer),
    ('2025-10-25'::date, 5109::bigint, 1721826::bigint, 1::integer),
    ('2025-11-02'::date, 5094::bigint, 1721826::bigint, 1::integer),
    ('2025-11-10'::date, 5079::bigint, 1721826::bigint, 1::integer),
    ('2025-12-03'::date, 5036::bigint, 21826::bigint, 1::integer),
    ('2025-12-10'::date, 5023::bigint, 21826::bigint, 1::integer),
    ('2025-12-18'::date, 5008::bigint, 21826::bigint, 1::integer),
    ('2025-12-19'::date, 5006::bigint, 21826::bigint, 1::integer),
    ('2026-01-31'::date, 4928::bigint, 21826::bigint, 1::integer),
    ('2026-02-19'::date, 4895::bigint, 16830::bigint, 1::integer),
    ('2026-02-22'::date, 4889::bigint, 16830::bigint, 1::integer),
    ('2026-02-26'::date, 4882::bigint, 21826::bigint, 1::integer),
    ('2026-03-01'::date, 4877::bigint, 16830::bigint, 1::integer),
    ('2026-03-13'::date, 4857::bigint, 18834::bigint, 1::integer),
    ('2026-03-14'::date, 4855::bigint, 18834::bigint, 1::integer),
    ('2026-03-19'::date, 4847::bigint, 15834::bigint, 1::integer),
    ('2026-03-24'::date, 4838::bigint, 15834::bigint, 1::integer),
    ('2026-03-28'::date, 4831::bigint, 15834::bigint, 1::integer),
    ('2026-03-30'::date, 4828::bigint, 15834::bigint, 1::integer),
    ('2026-03-31'::date, 4826::bigint, 15834::bigint, 1::integer),
    ('2026-04-02'::date, 4823::bigint, 55834::bigint, 1::integer),
    ('2026-04-06'::date, 4816::bigint, 55834::bigint, 1::integer),
    ('2026-04-09'::date, 4811::bigint, 1038834::bigint, 2::integer),
    ('2026-04-17'::date, 4813::bigint, 1031684::bigint, 2::integer),
    ('2026-04-20'::date, 4809::bigint, 1022684::bigint, 2::integer),
    ('2026-04-27'::date, 4800::bigint, 993684::bigint, 2::integer),
    ('2026-05-05'::date, 4903::bigint, 686682::bigint, 2::integer),
    ('2026-05-07'::date, 4899::bigint, 676682::bigint, 2::integer),
    ('2026-05-22'::date, 4877::bigint, 611682::bigint, 2::integer),
    ('2026-06-21'::date, 4834::bigint, 480659::bigint, 3::integer),
    ('2026-07-01'::date, 4815::bigint, 430648::bigint, 2::integer),
    ('2026-08-20'::date, 4738::bigint, 436567::bigint, 2::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 193 then
    raise exception '« % » : % relevés trouvés sur 193', 'Kob Koncept', v_count;
  end if;

  -- Armacham Souvenir : 192 relevés du 2024-03-04 au 2026-07-01, fermée le 2026-08-20.
  if exists (select 1 from public.companies where name = 'Armacham Souvenir' and closed_on = '2026-08-20') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Armacham Souvenir', '2026-08-20';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Armacham Souvenir' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Armacham Souvenir' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-07-01'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Armacham Souvenir', '2024-03-04', '2026-07-01';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Armacham Souvenir', array['Don''Expert'], v_profile, '2026-08-20', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 44413::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 44371::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 44329::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 44287::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 44245::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 44203::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 44161::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 44119::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 44077::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 43994::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 43952::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 43911::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 43869::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 43828::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 43787::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 43746::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 43705::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 43664::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 43623::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 43582::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 43541::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 43500::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 43471::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 43431::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 43390::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 43350::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 43309::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 43269::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 43229::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 43189::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 43149::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 43109::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 43069::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 42989::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 42950::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 42910::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 42871::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 42831::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 42792::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 42753::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 42713::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 42674::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 42636::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 42597::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 42521::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 42520::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 42481::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 42471::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 42433::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 42394::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 42356::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 42317::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 42241::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 42203::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 41712::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 41673::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 41441::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 40068::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 39499::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 39367::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 39358::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 39261::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 39196::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 38802::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 38839::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 38753::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 38722::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 38628::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 38566::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 38535::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 38505::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 38412::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 38320::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 38259::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 38198::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 38138::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 38047::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 37683::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 37571::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 37425::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 36870::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 36401::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 36374::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 36129::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 36049::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 35753::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 35711::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 35685::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 35613::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 35561::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 35509::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 35790::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 35737::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 35530::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 35283::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 35265::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 35335::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 35298::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 35305::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 35254::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 35287::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 35115::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 35017::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 34944::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 34919::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 34797::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 34651::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 34579::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 34605::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 34581::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 34509::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 34345::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 34227::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 33751::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 33710::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 33646::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 33603::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 33558::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 33750::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 33728::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 33706::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 33771::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 33739::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 33702::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 33665::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 33622::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 33601::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 33579::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 33537::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 33531::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 33488::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 33445::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 33424::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 33403::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 33382::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 33360::bigint, 1916627::bigint, 3::integer),
    ('2025-08-16'::date, 33339::bigint, 1916627::bigint, 3::integer),
    ('2025-08-17'::date, 33351::bigint, 1969127::bigint, 3::integer),
    ('2025-08-18'::date, 33330::bigint, 1969127::bigint, 3::integer),
    ('2025-08-19'::date, 33309::bigint, 1969127::bigint, 3::integer),
    ('2025-08-20'::date, 33288::bigint, 1969127::bigint, 3::integer),
    ('2025-08-21'::date, 33267::bigint, 1969127::bigint, 3::integer),
    ('2025-08-22'::date, 33246::bigint, 1969127::bigint, 3::integer),
    ('2025-08-23'::date, 33225::bigint, 1969127::bigint, 3::integer),
    ('2025-08-24'::date, 33204::bigint, 1969127::bigint, 3::integer),
    ('2025-08-25'::date, 33183::bigint, 1969127::bigint, 3::integer),
    ('2025-08-26'::date, 33162::bigint, 1969127::bigint, 2::integer),
    ('2025-08-27'::date, 33142::bigint, 1969127::bigint, 2::integer),
    ('2025-08-29'::date, 33100::bigint, 1964127::bigint, 3::integer),
    ('2025-08-30'::date, 33079::bigint, 1959127::bigint, 3::integer),
    ('2025-09-01'::date, 33044::bigint, 1960127::bigint, 2::integer),
    ('2025-09-07'::date, 33062::bigint, 2056127::bigint, 2::integer),
    ('2025-09-11'::date, 33062::bigint, 2159877::bigint, 2::integer),
    ('2025-09-12'::date, 33046::bigint, 2162877::bigint, 2::integer),
    ('2025-09-13'::date, 33037::bigint, 2176877::bigint, 2::integer),
    ('2025-09-21'::date, 33010::bigint, 2344940::bigint, 2::integer),
    ('2025-09-25'::date, 32994::bigint, 2446940::bigint, 2::integer),
    ('2025-10-01'::date, 32878::bigint, 2484940::bigint, 2::integer),
    ('2025-10-09'::date, 32930::bigint, 2767132::bigint, 2::integer),
    ('2025-10-14'::date, 32829::bigint, 2762132::bigint, 2::integer),
    ('2025-10-22'::date, 32695::bigint, 2784132::bigint, 2::integer),
    ('2025-10-24'::date, 32668::bigint, 2800232::bigint, 2::integer),
    ('2025-10-25'::date, 32648::bigint, 2800245::bigint, 2::integer),
    ('2025-11-02'::date, 32765::bigint, 2049446::bigint, 1::integer),
    ('2025-11-10'::date, 32625::bigint, 2251629::bigint, 2::integer),
    ('2025-12-03'::date, 32468::bigint, 3198624::bigint, 2::integer),
    ('2025-12-10'::date, 32481::bigint, 3412824::bigint, 2::integer),
    ('2025-12-18'::date, 32392::bigint, 3495924::bigint, 2::integer),
    ('2025-12-19'::date, 32387::bigint, 3515474::bigint, 2::integer),
    ('2026-01-31'::date, 31847::bigint, 2633601::bigint, 4::integer),
    ('2026-02-19'::date, 31639::bigint, 2595001::bigint, 2::integer),
    ('2026-02-22'::date, 31590::bigint, 2593001::bigint, 2::integer),
    ('2026-02-26'::date, 31539::bigint, 2633601::bigint, 3::integer),
    ('2026-03-01'::date, 31517::bigint, 2659554::bigint, 2::integer),
    ('2026-03-13'::date, 31509::bigint, 2964304::bigint, 2::integer),
    ('2026-03-14'::date, 31492::bigint, 2959304::bigint, 2::integer),
    ('2026-03-19'::date, 31464::bigint, 3041304::bigint, 2::integer),
    ('2026-03-24'::date, 31437::bigint, 3121404::bigint, 1::integer),
    ('2026-03-28'::date, 31367::bigint, 3111404::bigint, 2::integer),
    ('2026-03-30'::date, 31332::bigint, 3101404::bigint, 2::integer),
    ('2026-03-31'::date, 31315::bigint, 3096404::bigint, 2::integer),
    ('2026-04-02'::date, 31346::bigint, 3026554::bigint, 2::integer),
    ('2026-04-06'::date, 31302::bigint, 3052457::bigint, 2::integer),
    ('2026-04-09'::date, 31281::bigint, 3093457::bigint, 2::integer),
    ('2026-04-17'::date, 31161::bigint, 3204313::bigint, 2::integer),
    ('2026-04-20'::date, 31227::bigint, 837863::bigint, 2::integer),
    ('2026-04-27'::date, 31185::bigint, 880716::bigint, 2::integer),
    ('2026-05-05'::date, 31136::bigint, 1745569::bigint, 2::integer),
    ('2026-05-07'::date, 31102::bigint, 1735569::bigint, 2::integer),
    ('2026-05-22'::date, 31057::bigint, 1072819::bigint, 2::integer),
    ('2026-06-21'::date, 31400::bigint, 1879946::bigint, 3::integer),
    ('2026-07-01'::date, 31434::bigint, 2061802::bigint, 3::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 192 then
    raise exception '« % » : % relevés trouvés sur 192', 'Armacham Souvenir', v_count;
  end if;

  -- Don'Custom : 189 relevés du 2024-03-04 au 2026-05-07, fermée le 2026-05-22.
  if exists (select 1 from public.companies where name = 'Don''Custom' and closed_on = '2026-05-22') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Don''Custom', '2026-05-22';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Don''Custom' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Don''Custom' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-05-07'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Don''Custom', '2024-03-04', '2026-05-07';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Don''Custom', '{}'::text[], v_profile, '2026-05-22', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 40247::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 40225::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 40312::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 40290::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 40268::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 40246::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 40225::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 40203::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 40181::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 40138::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 40116::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 40094::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 40073::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 40051::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 40030::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 40008::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 39987::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 39965::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 39944::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 39922::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 39901::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 39879::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 39858::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 39838::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 39817::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 39796::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 39774::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 39753::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 39732::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 39711::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 39690::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 39668::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 39647::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 39605::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 39584::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 39563::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 39542::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 39521::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 39500::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 39479::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 39458::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 39437::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 39416::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 39395::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 39353::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 39333::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 39312::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 39270::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 39249::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 39229::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 39208::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 39187::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 39146::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 39125::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 38860::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 38779::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 38637::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 37684::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 37362::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 37287::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 37046::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 36991::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 36954::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 36717::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 36627::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 36572::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 36555::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 36501::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 36465::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 36447::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 36429::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 36376::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 36322::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 36287::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 36252::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 36216::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 36164::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 35936::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 35867::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 35781::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 37053::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 38838::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 38951::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 39058::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 39269::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 39067::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 39032::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 39015::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 38979::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 39016::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 39042::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 39492::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 39456::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 39753::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 39598::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 39566::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 39548::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 39527::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 39456::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 39420::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 39395::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 40372::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 40437::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 40383::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 40365::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 40281::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 40792::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 40740::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 40718::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 40700::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 40646::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 40635::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 40552::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 40596::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 40611::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 40637::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 40601::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 40566::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 40003::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 39986::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 39969::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 39781::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 39747::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 39680::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 39646::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 39613::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 39596::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 39579::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 39545::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 39529::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 39717::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 39684::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 40530::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 40513::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 40496::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 40538::bigint, 9435983::bigint, 2::integer),
    ('2025-08-16'::date, 40520::bigint, 9425483::bigint, 2::integer),
    ('2025-08-17'::date, 40503::bigint, 9418733::bigint, 2::integer),
    ('2025-08-18'::date, 40486::bigint, 9412983::bigint, 2::integer),
    ('2025-08-19'::date, 40469::bigint, 9402483::bigint, 2::integer),
    ('2025-08-20'::date, 40452::bigint, 9393983::bigint, 2::integer),
    ('2025-08-21'::date, 40435::bigint, 9385483::bigint, 2::integer),
    ('2025-08-22'::date, 40418::bigint, 9377483::bigint, 2::integer),
    ('2025-08-23'::date, 40401::bigint, 9369733::bigint, 2::integer),
    ('2025-08-24'::date, 40385::bigint, 9361483::bigint, 2::integer),
    ('2025-08-25'::date, 40368::bigint, 9354983::bigint, 2::integer),
    ('2025-08-26'::date, 40351::bigint, 9354983::bigint, 3::integer),
    ('2025-08-27'::date, 40335::bigint, 9007233::bigint, 3::integer),
    ('2025-08-29'::date, 40302::bigint, 7445733::bigint, 3::integer),
    ('2025-08-30'::date, 40554::bigint, 7731233::bigint, 3::integer),
    ('2025-09-01'::date, 41784::bigint, 8547733::bigint, 3::integer),
    ('2025-09-07'::date, 43944::bigint, 8291283::bigint, 3::integer),
    ('2025-09-11'::date, 43944::bigint, 8434533::bigint, 3::integer),
    ('2025-09-12'::date, 43926::bigint, 8434533::bigint, 3::integer),
    ('2025-09-13'::date, 44195::bigint, 8789533::bigint, 3::integer),
    ('2025-09-21'::date, 45127::bigint, 9436983::bigint, 3::integer),
    ('2025-09-25'::date, 45934::bigint, 10610284::bigint, 3::integer),
    ('2025-10-01'::date, 46708::bigint, 10993113::bigint, 3::integer),
    ('2025-10-09'::date, 47125::bigint, 10802313::bigint, 3::integer),
    ('2025-10-14'::date, 47232::bigint, 10211813::bigint, 3::integer),
    ('2025-10-22'::date, 49995::bigint, 11561120::bigint, 3::integer),
    ('2025-10-24'::date, 50055::bigint, 11694870::bigint, 3::integer),
    ('2025-10-25'::date, 50034::bigint, 11680370::bigint, 3::integer),
    ('2025-11-02'::date, 50817::bigint, 11870526::bigint, 3::integer),
    ('2025-11-10'::date, 52155::bigint, 13957736::bigint, 3::integer),
    ('2025-12-03'::date, 52764::bigint, 14212086::bigint, 3::integer),
    ('2025-12-10'::date, 52615::bigint, 14146336::bigint, 3::integer),
    ('2025-12-18'::date, 52449::bigint, 14106636::bigint, 2::integer),
    ('2025-12-19'::date, 52428::bigint, 14106636::bigint, 2::integer),
    ('2026-01-31'::date, 51710::bigint, 15618137::bigint, 2::integer),
    ('2026-02-19'::date, 51327::bigint, 15805637::bigint, 2::integer),
    ('2026-02-22'::date, 51267::bigint, 15805637::bigint, 2::integer),
    ('2026-02-26'::date, 51187::bigint, 15618137::bigint, 2::integer),
    ('2026-03-01'::date, 51128::bigint, 15805637::bigint, 2::integer),
    ('2026-03-13'::date, 50890::bigint, 15805637::bigint, 1::integer),
    ('2026-03-14'::date, 50870::bigint, 15805637::bigint, 1::integer),
    ('2026-03-19'::date, 50772::bigint, 15805637::bigint, 1::integer),
    ('2026-03-24'::date, 50674::bigint, 15805637::bigint, 1::integer),
    ('2026-03-28'::date, 50596::bigint, 3778509::bigint, 1::integer),
    ('2026-03-30'::date, 50557::bigint, 3778509::bigint, 1::integer),
    ('2026-03-31'::date, 50537::bigint, 3780059::bigint, 1::integer),
    ('2026-04-02'::date, 50499::bigint, 3780059::bigint, 1::integer),
    ('2026-04-06'::date, 50421::bigint, 3780059::bigint, 1::integer),
    ('2026-04-09'::date, 50363::bigint, 3780059::bigint, 1::integer),
    ('2026-04-17'::date, 50209::bigint, 3780059::bigint, 1::integer),
    ('2026-04-20'::date, 50152::bigint, 3780059::bigint, 1::integer),
    ('2026-04-27'::date, 50018::bigint, 3780059::bigint, 1::integer),
    ('2026-05-05'::date, 49866::bigint, 3780059::bigint, 1::integer),
    ('2026-05-07'::date, 49828::bigint, 3780059::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 189 then
    raise exception '« % » : % relevés trouvés sur 189', 'Don''Custom', v_count;
  end if;

  -- Equinox : 188 relevés du 2024-03-04 au 2026-05-05, fermée le 2026-05-07.
  if exists (select 1 from public.companies where name = 'Equinox' and closed_on = '2026-05-07') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Equinox', '2026-05-07';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Equinox' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Equinox' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-05-05'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Equinox', '2024-03-04', '2026-05-05';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Equinox', '{}'::text[], v_profile, '2026-05-07', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 266078::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 265646::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 265216::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 264787::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 264359::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 263933::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 263508::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 263084::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 262662::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 261821::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 261403::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 260986::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 260570::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 260156::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 259743::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 259332::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 258921::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 258512::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 258104::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 257698::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 257293::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 256889::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 256486::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 256085::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 256435::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 256035::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 255636::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 255238::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 254842::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 254447::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 254053::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 253660::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 253269::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 252490::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 252102::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 251715::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 251330::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 250945::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 250562::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 250180::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 249799::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 249420::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 249041::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 249264::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 248511::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 248136::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 247762::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 247018::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 246713::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 246343::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 245975::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 245608::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 244877::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 244513::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 240954::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 239557::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 237151::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 223417::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 218446::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 217308::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 213691::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 212874::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 212332::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 208877::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 207578::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 206806::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 206551::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 205786::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 205280::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 207188::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 206934::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 206175::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 205421::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 204922::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 204425::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 204560::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 213459::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 211834::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 210833::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 209596::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 227299::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 241589::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 241319::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 243687::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 242882::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 241308::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 240785::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 240524::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 239745::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 252188::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 251645::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 252857::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 252316::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 251456::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 249009::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 248489::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 250024::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 249503::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 249026::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 249167::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 247883::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 245547::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 244552::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 243811::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 243565::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 243856::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 242396::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 241847::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 240780::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 240542::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 239830::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 237720::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 238973::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 233966::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 238775::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 236375::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 235932::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 235490::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 232665::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 232455::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 232245::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 229966::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 229557::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 228742::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 228337::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 227933::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 227732::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 227531::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 227130::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 226930::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 226531::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 226134::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 225935::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 225738::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 225540::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 225343::bigint, 24306087::bigint, 2::integer),
    ('2025-08-16'::date, 225146::bigint, 24306063::bigint, 2::integer),
    ('2025-08-17'::date, 224950::bigint, 24306039::bigint, 2::integer),
    ('2025-08-18'::date, 224754::bigint, 25126014::bigint, 2::integer),
    ('2025-08-19'::date, 224558::bigint, 25125990::bigint, 2::integer),
    ('2025-08-20'::date, 224362::bigint, 25125966::bigint, 2::integer),
    ('2025-08-21'::date, 224167::bigint, 25125942::bigint, 2::integer),
    ('2025-08-22'::date, 223972::bigint, 25125918::bigint, 2::integer),
    ('2025-08-23'::date, 223778::bigint, 25125894::bigint, 2::integer),
    ('2025-08-24'::date, 223584::bigint, 25125870::bigint, 2::integer),
    ('2025-08-25'::date, 223390::bigint, 25125846::bigint, 2::integer),
    ('2025-08-26'::date, 223197::bigint, 25125822::bigint, 2::integer),
    ('2025-08-27'::date, 223004::bigint, 25125798::bigint, 2::integer),
    ('2025-08-29'::date, 222619::bigint, 25125750::bigint, 2::integer),
    ('2025-08-30'::date, 222426::bigint, 25125726::bigint, 2::integer),
    ('2025-09-01'::date, 222043::bigint, 26795677::bigint, 2::integer),
    ('2025-09-07'::date, 220902::bigint, 23739532::bigint, 2::integer),
    ('2025-09-11'::date, 220519::bigint, 23682676::bigint, 2::integer),
    ('2025-09-12'::date, 220331::bigint, 23682652::bigint, 2::integer),
    ('2025-09-13'::date, 220349::bigint, 23924548::bigint, 2::integer),
    ('2025-09-21'::date, 218856::bigint, 21448473::bigint, 2::integer),
    ('2025-09-25'::date, 218118::bigint, 21248377::bigint, 2::integer),
    ('2025-10-01'::date, 218539::bigint, 23258336::bigint, 2::integer),
    ('2025-10-09'::date, 217621::bigint, 23906144::bigint, 2::integer),
    ('2025-10-14'::date, 216717::bigint, 27806023::bigint, 2::integer),
    ('2025-10-22'::date, 215287::bigint, 27805831::bigint, 2::integer),
    ('2025-10-24'::date, 214932::bigint, 28555782::bigint, 2::integer),
    ('2025-10-25'::date, 214755::bigint, 28555758::bigint, 2::integer),
    ('2025-11-02'::date, 213350::bigint, 29005564::bigint, 2::integer),
    ('2025-11-10'::date, 211964::bigint, 29205371::bigint, 2::integer),
    ('2025-12-03'::date, 208076::bigint, 30484818::bigint, 2::integer),
    ('2025-12-10'::date, 206921::bigint, 30884674::bigint, 2::integer),
    ('2025-12-18'::date, 205617::bigint, 31084482::bigint, 2::integer),
    ('2025-12-19'::date, 205455::bigint, 31084458::bigint, 2::integer),
    ('2026-01-31'::date, 198726::bigint, 27643455::bigint, 2::integer),
    ('2026-02-19'::date, 197102::bigint, 29883000::bigint, 2::integer),
    ('2026-02-22'::date, 196659::bigint, 29882928::bigint, 2::integer),
    ('2026-02-26'::date, 196071::bigint, 27643455::bigint, 2::integer),
    ('2026-03-01'::date, 195633::bigint, 30632760::bigint, 3::integer),
    ('2026-03-13'::date, 193899::bigint, 30632498::bigint, 3::integer),
    ('2026-03-14'::date, 193756::bigint, 30632473::bigint, 3::integer),
    ('2026-03-19'::date, 193044::bigint, 31431349::bigint, 3::integer),
    ('2026-03-24'::date, 192873::bigint, 27431250::bigint, 4::integer),
    ('2026-03-28'::date, 192309::bigint, 27431238::bigint, 4::integer),
    ('2026-03-30'::date, 192029::bigint, 27431232::bigint, 4::integer),
    ('2026-03-31'::date, 191889::bigint, 27431229::bigint, 4::integer),
    ('2026-04-02'::date, 191610::bigint, 27431223::bigint, 4::integer),
    ('2026-04-06'::date, 191053::bigint, 23431211::bigint, 4::integer),
    ('2026-04-09'::date, 190728::bigint, 23555202::bigint, 4::integer),
    ('2026-04-17'::date, 189630::bigint, 23555178::bigint, 4::integer),
    ('2026-04-20'::date, 189221::bigint, 23555169::bigint, 4::integer),
    ('2026-04-27'::date, 188274::bigint, 23555148::bigint, 4::integer),
    ('2026-05-05'::date, 187204::bigint, 255134::bigint, 3::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 188 then
    raise exception '« % » : % relevés trouvés sur 188', 'Equinox', v_count;
  end if;

  -- Le Continental : 185 relevés du 2024-03-04 au 2026-04-17, fermée le 2026-04-20.
  if exists (select 1 from public.companies where name = 'Le Continental' and closed_on = '2026-04-20') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Le Continental', '2026-04-20';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Le Continental' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Le Continental' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-04-17'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Le Continental', '2024-03-04', '2026-04-17';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Le Continental', '{}'::text[], v_profile, '2026-04-20', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 5841::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 5832::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 5832::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 5826::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 5818::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 5812::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 5813::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 5815::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 5807::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 5800::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 5796::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 5790::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 5789::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 5784::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 5778::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 5787::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 5785::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 5785::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 5781::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 5782::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 5776::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 5800::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 5795::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 5807::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 5798::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 5799::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 5792::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 5814::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 5823::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 5819::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 5829::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 5824::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 5819::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 5808::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 5806::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 5798::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 5795::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 5788::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 5779::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 5777::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 5771::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 5767::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 5761::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 5757::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 5744::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 5738::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 5729::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 5714::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 5713::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 5708::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 5701::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 5696::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 5687::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 5682::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 5627::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 5623::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 5622::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 5527::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 5438::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 5443::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 5424::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 5406::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 5397::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 5375::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 5352::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 5341::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 5335::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 5335::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 5323::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 5319::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 5313::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 5304::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 5299::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 5293::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 5283::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 5272::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 5272::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 5274::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 5267::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 5240::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 5149::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 5033::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 5028::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 4981::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 4977::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 4952::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 4944::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 4938::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 4932::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 4929::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 4920::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 4911::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 4905::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 4891::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 4870::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 4863::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 4858::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 4850::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 4832::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 4824::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 4798::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 4748::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 4737::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 4806::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 4802::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 4785::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 4771::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 4768::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 4762::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 4767::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 4780::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 4758::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 4741::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 4689::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 4679::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 4631::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 4623::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 4615::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 4462::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 4458::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 4454::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 4415::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 4407::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 4397::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 4394::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 4387::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 4383::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 4379::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 4372::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 4368::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 4360::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 4355::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 4352::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 4349::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 4345::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 4341::bigint, 120967732::bigint, 3::integer),
    ('2025-08-16'::date, 4338::bigint, 120968682::bigint, 3::integer),
    ('2025-08-17'::date, 4335::bigint, 120968682::bigint, 3::integer),
    ('2025-08-18'::date, 4331::bigint, 120968682::bigint, 3::integer),
    ('2025-08-19'::date, 4327::bigint, 120968682::bigint, 3::integer),
    ('2025-08-20'::date, 4325::bigint, 120970082::bigint, 3::integer),
    ('2025-08-21'::date, 4322::bigint, 120970532::bigint, 3::integer),
    ('2025-08-22'::date, 4318::bigint, 120970532::bigint, 3::integer),
    ('2025-08-23'::date, 4314::bigint, 120970532::bigint, 3::integer),
    ('2025-08-24'::date, 4311::bigint, 120971032::bigint, 3::integer),
    ('2025-08-25'::date, 4308::bigint, 120971982::bigint, 3::integer),
    ('2025-08-26'::date, 4304::bigint, 120971982::bigint, 3::integer),
    ('2025-08-27'::date, 4301::bigint, 120967982::bigint, 3::integer),
    ('2025-08-29'::date, 4294::bigint, 120963982::bigint, 3::integer),
    ('2025-08-30'::date, 4290::bigint, 120963982::bigint, 3::integer),
    ('2025-09-01'::date, 4284::bigint, 120965882::bigint, 3::integer),
    ('2025-09-07'::date, 4264::bigint, 120963782::bigint, 3::integer),
    ('2025-09-11'::date, 4250::bigint, 120963782::bigint, 3::integer),
    ('2025-09-12'::date, 4247::bigint, 120963782::bigint, 3::integer),
    ('2025-09-13'::date, 4243::bigint, 120959782::bigint, 3::integer),
    ('2025-09-21'::date, 4216::bigint, 120952732::bigint, 3::integer),
    ('2025-09-25'::date, 4202::bigint, 120944732::bigint, 3::integer),
    ('2025-10-01'::date, 4183::bigint, 120939082::bigint, 3::integer),
    ('2025-10-09'::date, 4158::bigint, 120937532::bigint, 3::integer),
    ('2025-10-14'::date, 4143::bigint, 120928682::bigint, 3::integer),
    ('2025-10-22'::date, 4117::bigint, 120924682::bigint, 3::integer),
    ('2025-10-24'::date, 4117::bigint, 120924782::bigint, 3::integer),
    ('2025-10-25'::date, 4113::bigint, 120924782::bigint, 3::integer),
    ('2025-11-02'::date, 4092::bigint, 120919532::bigint, 2::integer),
    ('2025-11-10'::date, 4067::bigint, 120912982::bigint, 2::integer),
    ('2025-12-03'::date, 3996::bigint, 120906882::bigint, 2::integer),
    ('2025-12-10'::date, 3974::bigint, 120906882::bigint, 2::integer),
    ('2025-12-18'::date, 3950::bigint, 120906882::bigint, 2::integer),
    ('2025-12-19'::date, 3947::bigint, 120902882::bigint, 2::integer),
    ('2026-01-31'::date, 3822::bigint, 120897232::bigint, 2::integer),
    ('2026-02-19'::date, 3777::bigint, 120863362::bigint, 2::integer),
    ('2026-02-22'::date, 3770::bigint, 120859362::bigint, 2::integer),
    ('2026-02-26'::date, 3763::bigint, 120897232::bigint, 2::integer),
    ('2026-03-01'::date, 3756::bigint, 120845392::bigint, 2::integer),
    ('2026-03-13'::date, 3727::bigint, 120836482::bigint, 2::integer),
    ('2026-03-14'::date, 3728::bigint, 120834982::bigint, 2::integer),
    ('2026-03-19'::date, 3717::bigint, 120830982::bigint, 2::integer),
    ('2026-03-24'::date, 3721::bigint, 25852392::bigint, 1::integer),
    ('2026-03-28'::date, 3711::bigint, 25852392::bigint, 1::integer),
    ('2026-03-30'::date, 3706::bigint, 25852392::bigint, 1::integer),
    ('2026-03-31'::date, 3703::bigint, 25852392::bigint, 1::integer),
    ('2026-04-02'::date, 3698::bigint, 25852392::bigint, 1::integer),
    ('2026-04-06'::date, 3687::bigint, 25852392::bigint, 1::integer),
    ('2026-04-09'::date, 3679::bigint, 25852392::bigint, 1::integer),
    ('2026-04-17'::date, 3658::bigint, 25852392::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 185 then
    raise exception '« % » : % relevés trouvés sur 185', 'Le Continental', v_count;
  end if;

  -- Vindicta Templum : 179 relevés du 2024-03-04 au 2026-03-28, fermée le 2026-03-30.
  if exists (select 1 from public.companies where name = 'Vindicta Templum' and closed_on = '2026-03-30') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Vindicta Templum', '2026-03-30';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Vindicta Templum' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Vindicta Templum' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-03-28'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Vindicta Templum', '2024-03-04', '2026-03-28';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Vindicta Templum', '{}'::text[], v_profile, '2026-03-30', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 23651::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 23640::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 23629::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 23618::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 23607::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 23596::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 23585::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 23574::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 23563::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 23541::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 23530::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 23519::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 23508::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 23497::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 23486::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 23475::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 23464::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 23453::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 23442::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 23432::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 23421::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 23410::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 23399::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 23388::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 23377::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 23366::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 23356::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 23345::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 23334::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 23323::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 23312::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 23302::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 23291::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 23269::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 23259::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 23248::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 23237::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 23227::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 23216::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 23205::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 23195::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 23184::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 23173::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 23163::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 23141::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 23131::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 23120::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 23099::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 23088::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 23078::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 23067::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 23057::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 23036::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 23025::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 22889::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 22848::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 22776::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 22273::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 22107::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 22068::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 21944::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 21915::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 21896::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 21773::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 21726::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 21698::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 21689::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 21661::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 21642::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 21633::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 21624::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 21596::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 21568::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 21550::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 21531::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 21513::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 21486::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 21367::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 21331::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 21286::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 21108::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 20907::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 20898::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 20821::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 21109::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 21005::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 21398::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 21389::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 21363::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 21345::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 21328::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 21310::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 21293::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 21215::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 21112::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 21095::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 21087::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 21070::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 21036::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 21019::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 20968::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 20876::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 20842::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 20817::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 20809::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 20768::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 20718::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 20694::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 20653::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 20645::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 20620::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 20547::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 20507::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 20421::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 20389::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 20302::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 20286::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 20271::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 20350::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 20343::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 20335::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 20250::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 20235::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 20204::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 20189::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 20174::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 20166::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 20159::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 20143::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 20136::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 20121::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 20105::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 20098::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 20090::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 20083::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 20075::bigint, 6941629::bigint, 1::integer),
    ('2025-08-16'::date, 20068::bigint, 6927940::bigint, 1::integer),
    ('2025-08-17'::date, 20060::bigint, 6914251::bigint, 1::integer),
    ('2025-08-18'::date, 20053::bigint, 6900562::bigint, 1::integer),
    ('2025-08-19'::date, 20045::bigint, 6886873::bigint, 1::integer),
    ('2025-08-20'::date, 20038::bigint, 6873184::bigint, 1::integer),
    ('2025-08-21'::date, 20030::bigint, 6859495::bigint, 1::integer),
    ('2025-08-22'::date, 20023::bigint, 6845806::bigint, 1::integer),
    ('2025-08-23'::date, 20015::bigint, 6832117::bigint, 1::integer),
    ('2025-08-24'::date, 20008::bigint, 5788428::bigint, 1::integer),
    ('2025-08-25'::date, 20000::bigint, 5774739::bigint, 1::integer),
    ('2025-08-26'::date, 19993::bigint, 5761050::bigint, 1::integer),
    ('2025-08-27'::date, 19985::bigint, 5747361::bigint, 1::integer),
    ('2025-08-29'::date, 19970::bigint, 5719983::bigint, 1::integer),
    ('2025-08-30'::date, 19963::bigint, 5706294::bigint, 1::integer),
    ('2025-09-01'::date, 19948::bigint, 5678916::bigint, 1::integer),
    ('2025-09-07'::date, 19903::bigint, 5596782::bigint, 1::integer),
    ('2025-09-11'::date, 19874::bigint, 6051334::bigint, 1::integer),
    ('2025-09-12'::date, 19866::bigint, 6187878::bigint, 1::integer),
    ('2025-09-13'::date, 19859::bigint, 6174422::bigint, 1::integer),
    ('2025-09-21'::date, 19800::bigint, 6066774::bigint, 1::integer),
    ('2025-09-25'::date, 19771::bigint, 6012950::bigint, 1::integer),
    ('2025-10-01'::date, 19727::bigint, 5932214::bigint, 1::integer),
    ('2025-10-09'::date, 19669::bigint, 5824566::bigint, 1::integer),
    ('2025-10-14'::date, 19633::bigint, 5757286::bigint, 1::integer),
    ('2025-10-22'::date, 19575::bigint, 5649638::bigint, 1::integer),
    ('2025-10-24'::date, 19561::bigint, 5622726::bigint, 1::integer),
    ('2025-10-25'::date, 19554::bigint, 5609270::bigint, 1::integer),
    ('2025-11-02'::date, 19497::bigint, 3891622::bigint, 1::integer),
    ('2025-11-10'::date, 19440::bigint, 3783974::bigint, 1::integer),
    ('2025-12-03'::date, 19279::bigint, 2524486::bigint, 1::integer),
    ('2025-12-10'::date, 19230::bigint, 2430294::bigint, 1::integer),
    ('2025-12-18'::date, 19175::bigint, 4122646::bigint, 1::integer),
    ('2025-12-19'::date, 19168::bigint, 4109190::bigint, 1::integer),
    ('2026-01-31'::date, 18877::bigint, 3566582::bigint, 1::integer),
    ('2026-02-19'::date, 18751::bigint, 3310918::bigint, 1::integer),
    ('2026-02-22'::date, 18731::bigint, 3270550::bigint, 1::integer),
    ('2026-02-26'::date, 18705::bigint, 3566582::bigint, 1::integer),
    ('2026-03-01'::date, 18685::bigint, 3176358::bigint, 1::integer),
    ('2026-03-13'::date, 18607::bigint, 3014886::bigint, 1::integer),
    ('2026-03-14'::date, 18601::bigint, 3001430::bigint, 1::integer),
    ('2026-03-19'::date, 18569::bigint, 2934150::bigint, 1::integer),
    ('2026-03-24'::date, 18536::bigint, 2866870::bigint, 1::integer),
    ('2026-03-28'::date, 18511::bigint, 2813046::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 179 then
    raise exception '« % » : % relevés trouvés sur 179', 'Vindicta Templum', v_count;
  end if;

  -- SMI Tech Prim' : 180 relevés du 2024-03-04 au 2026-03-30, fermée le 2026-03-31.
  if exists (select 1 from public.companies where name = 'SMI Tech Prim''' and closed_on = '2026-03-31') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'SMI Tech Prim''', '2026-03-31';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'SMI Tech Prim''' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'SMI Tech Prim''' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-03-30'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'SMI Tech Prim''', '2024-03-04', '2026-03-30';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('SMI Tech Prim''', '{}'::text[], v_profile, '2026-03-31', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 289591::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 289410::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 289230::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 289049::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 288869::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 288782::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 288603::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 288423::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 288244::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 287886::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 287707::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 287528::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 287350::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 287172::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 286994::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 286817::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 286639::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 286462::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 286285::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 286109::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 285932::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 285756::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 285580::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 285404::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 285228::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 285151::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 285160::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 284985::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 284810::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 284635::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 284461::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 284286::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 284112::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 283765::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 283591::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 283418::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 283245::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 283072::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 283002::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 282830::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 282657::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 282485::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 282314::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 282643::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 282300::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 282128::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 281957::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 281616::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 281445::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 281275::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 281105::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 280935::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 280596::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 280427::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 279828::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 279159::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 278254::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 271189::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 268759::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 268365::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 269099::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 268817::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 268513::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 267137::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 266498::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 266052::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 265903::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 265459::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 265164::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 265016::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 264869::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 264428::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 263989::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 263697::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 263664::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 263505::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 263517::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 261757::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 261256::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 260708::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 258542::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 255901::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 255765::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 254699::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 254342::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 252740::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 252475::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 252342::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 251946::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 251683::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 251420::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 251158::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 251562::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 251709::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 250435::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 250394::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 250265::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 250078::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 249565::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 249363::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 248598::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 247338::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 246913::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 246538::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 246413::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 246222::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 245478::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 246145::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 245528::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 245405::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 245037::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 244287::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 243680::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 241182::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 240827::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 240412::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 240178::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 239944::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 235624::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 235512::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 235400::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 234170::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 233948::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 233727::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 233506::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 233286::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 233175::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 233065::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 232886::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 232776::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 232557::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 232338::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 232229::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 232120::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 232074::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 231965::bigint, 27115815::bigint, 1::integer),
    ('2025-08-16'::date, 231856::bigint, 27115815::bigint, 1::integer),
    ('2025-08-17'::date, 231747::bigint, 27115815::bigint, 1::integer),
    ('2025-08-18'::date, 231638::bigint, 27115815::bigint, 1::integer),
    ('2025-08-19'::date, 231530::bigint, 27115815::bigint, 1::integer),
    ('2025-08-20'::date, 231421::bigint, 27115815::bigint, 1::integer),
    ('2025-08-21'::date, 231313::bigint, 27115815::bigint, 1::integer),
    ('2025-08-22'::date, 231205::bigint, 27115815::bigint, 1::integer),
    ('2025-08-23'::date, 231096::bigint, 27115815::bigint, 1::integer),
    ('2025-08-24'::date, 230988::bigint, 27115815::bigint, 1::integer),
    ('2025-08-25'::date, 230993::bigint, 27355815::bigint, 1::integer),
    ('2025-08-26'::date, 230885::bigint, 27355815::bigint, 1::integer),
    ('2025-08-27'::date, 230777::bigint, 27355815::bigint, 1::integer),
    ('2025-08-29'::date, 230561::bigint, 27355815::bigint, 1::integer),
    ('2025-08-30'::date, 230454::bigint, 27355815::bigint, 1::integer),
    ('2025-09-01'::date, 230239::bigint, 27355815::bigint, 1::integer),
    ('2025-09-07'::date, 229597::bigint, 27355815::bigint, 1::integer),
    ('2025-09-11'::date, 229171::bigint, 27355815::bigint, 1::integer),
    ('2025-09-12'::date, 229065::bigint, 27355815::bigint, 1::integer),
    ('2025-09-13'::date, 228959::bigint, 27355815::bigint, 1::integer),
    ('2025-09-21'::date, 228113::bigint, 27355815::bigint, 1::integer),
    ('2025-09-25'::date, 227693::bigint, 27355815::bigint, 1::integer),
    ('2025-10-01'::date, 227126::bigint, 27487815::bigint, 1::integer),
    ('2025-10-09'::date, 226294::bigint, 27487815::bigint, 1::integer),
    ('2025-10-14'::date, 225777::bigint, 27487815::bigint, 1::integer),
    ('2025-10-22'::date, 224955::bigint, 27487815::bigint, 1::integer),
    ('2025-10-24'::date, 224750::bigint, 27487815::bigint, 1::integer),
    ('2025-10-25'::date, 224648::bigint, 27487815::bigint, 1::integer),
    ('2025-11-02'::date, 223975::bigint, 27798615::bigint, 1::integer),
    ('2025-11-10'::date, 223166::bigint, 27798615::bigint, 1::integer),
    ('2025-12-03'::date, 220874::bigint, 27798615::bigint, 1::integer),
    ('2025-12-10'::date, 220185::bigint, 27798615::bigint, 1::integer),
    ('2025-12-18'::date, 219404::bigint, 27798615::bigint, 1::integer),
    ('2025-12-19'::date, 219306::bigint, 27798615::bigint, 1::integer),
    ('2026-01-31'::date, 215437::bigint, 28336615::bigint, 1::integer),
    ('2026-02-19'::date, 213836::bigint, 28720615::bigint, 1::integer),
    ('2026-02-22'::date, 213673::bigint, 28984615::bigint, 1::integer),
    ('2026-02-26'::date, 213305::bigint, 28336615::bigint, 1::integer),
    ('2026-03-01'::date, 213030::bigint, 28984615::bigint, 1::integer),
    ('2026-03-13'::date, 212020::bigint, 29368615::bigint, 1::integer),
    ('2026-03-14'::date, 212011::bigint, 29368615::bigint, 1::integer),
    ('2026-03-19'::date, 211559::bigint, 29368615::bigint, 1::integer),
    ('2026-03-24'::date, 211109::bigint, 29368615::bigint, 1::integer),
    ('2026-03-28'::date, 210750::bigint, 29368615::bigint, 1::integer),
    ('2026-03-30'::date, 210571::bigint, 29368615::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 180 then
    raise exception '« % » : % relevés trouvés sur 180', 'SMI Tech Prim''', v_count;
  end if;

  -- Le Lux : 178 relevés du 2024-03-04 au 2026-03-24, fermée le 2026-03-28.
  if exists (select 1 from public.companies where name = 'Le Lux' and closed_on = '2026-03-28') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Le Lux', '2026-03-28';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Le Lux' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Le Lux' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-03-24'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Le Lux', '2024-03-04', '2026-03-24';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Le Lux', '{}'::text[], v_profile, '2026-03-28', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 13712::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 13693::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 13679::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 13664::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 13644::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 13630::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 13616::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 13599::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 13584::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 13556::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 13538::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 13527::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 13513::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 13498::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 13504::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 13483::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 13471::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 13451::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 13433::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 13421::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 13403::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 13388::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 13371::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 13355::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 13345::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 13335::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 13322::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 13306::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 13287::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 13273::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 13253::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 13241::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 13222::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 13189::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 13172::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 13155::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 13138::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 13124::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 13107::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 13089::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 13080::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 13068::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 13056::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 13042::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 13016::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 13008::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 12993::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 12969::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 12969::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 12956::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 12944::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 12937::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 12917::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 12901::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 12706::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 12661::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 12558::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 11905::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 11732::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 11689::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 11534::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 11490::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 11468::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 11329::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 11285::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 11250::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 11238::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 11209::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 11197::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 11190::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 11176::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 11160::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 11131::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 11116::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 11110::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 11090::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 11063::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 10944::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 10911::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 10869::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 10721::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 10538::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 10533::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 10449::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 10429::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 10366::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 10354::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 10350::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 10335::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 10324::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 10310::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 10300::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 10289::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 10219::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 10136::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 10122::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 10114::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 10100::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 10076::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 10060::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 10024::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 9958::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 9944::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 9933::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 9931::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 9907::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 9871::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 9865::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 9839::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 9836::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 9829::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 9788::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 9767::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 9627::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 9624::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 9567::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 9555::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 9555::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 9365::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 9360::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 9353::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 9322::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 9318::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 9315::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 9309::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 9295::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 9291::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 9289::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 9275::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 9271::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 9267::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 9266::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 9259::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 9254::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 9254::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 9250::bigint, 3188619::bigint, 2::integer),
    ('2025-08-16'::date, 9252::bigint, 3199369::bigint, 2::integer),
    ('2025-08-17'::date, 9248::bigint, 3203119::bigint, 2::integer),
    ('2025-08-18'::date, 9245::bigint, 3206319::bigint, 2::integer),
    ('2025-08-19'::date, 9243::bigint, 3214869::bigint, 2::integer),
    ('2025-08-20'::date, 9237::bigint, 3221869::bigint, 2::integer),
    ('2025-08-21'::date, 9236::bigint, 3225869::bigint, 2::integer),
    ('2025-08-22'::date, 9247::bigint, 3233519::bigint, 2::integer),
    ('2025-08-23'::date, 9243::bigint, 3242269::bigint, 2::integer),
    ('2025-08-24'::date, 9245::bigint, 3250969::bigint, 2::integer),
    ('2025-08-25'::date, 9244::bigint, 3256369::bigint, 2::integer),
    ('2025-08-26'::date, 9240::bigint, 3263919::bigint, 2::integer),
    ('2025-08-27'::date, 9245::bigint, 3280219::bigint, 2::integer),
    ('2025-08-29'::date, 9245::bigint, 3283369::bigint, 2::integer),
    ('2025-08-30'::date, 9238::bigint, 3289219::bigint, 2::integer),
    ('2025-09-01'::date, 9242::bigint, 3307119::bigint, 2::integer),
    ('2025-09-07'::date, 9249::bigint, 3374019::bigint, 2::integer),
    ('2025-09-11'::date, 9238::bigint, 3396669::bigint, 2::integer),
    ('2025-09-12'::date, 9240::bigint, 3404069::bigint, 2::integer),
    ('2025-09-13'::date, 9238::bigint, 3405269::bigint, 2::integer),
    ('2025-09-21'::date, 9253::bigint, 3495319::bigint, 2::integer),
    ('2025-09-25'::date, 9261::bigint, 3479669::bigint, 2::integer),
    ('2025-10-01'::date, 9262::bigint, 3535469::bigint, 2::integer),
    ('2025-10-09'::date, 9266::bigint, 3588419::bigint, 2::integer),
    ('2025-10-14'::date, 9262::bigint, 3602769::bigint, 2::integer),
    ('2025-10-22'::date, 9244::bigint, 3648229::bigint, 2::integer),
    ('2025-10-24'::date, 9244::bigint, 3665829::bigint, 2::integer),
    ('2025-10-25'::date, 9246::bigint, 3674229::bigint, 1::integer),
    ('2025-11-02'::date, 9231::bigint, 3725829::bigint, 1::integer),
    ('2025-11-10'::date, 9216::bigint, 3750029::bigint, 1::integer),
    ('2025-12-03'::date, 9175::bigint, 3822089::bigint, 1::integer),
    ('2025-12-10'::date, 9153::bigint, 3855839::bigint, 1::integer),
    ('2025-12-18'::date, 9135::bigint, 3905539::bigint, 1::integer),
    ('2025-12-19'::date, 9132::bigint, 3910339::bigint, 1::integer),
    ('2026-01-31'::date, 8983::bigint, 3987249::bigint, 1::integer),
    ('2026-02-19'::date, 8926::bigint, 4084749::bigint, 1::integer),
    ('2026-02-22'::date, 8918::bigint, 4095199::bigint, 1::integer),
    ('2026-02-26'::date, 8908::bigint, 3987249::bigint, 1::integer),
    ('2026-03-01'::date, 8893::bigint, 4125599::bigint, 1::integer),
    ('2026-03-13'::date, 8846::bigint, 4159599::bigint, 1::integer),
    ('2026-03-14'::date, 8847::bigint, 4164999::bigint, 1::integer),
    ('2026-03-19'::date, 8829::bigint, 4191449::bigint, 1::integer),
    ('2026-03-24'::date, 8816::bigint, 4145249::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 178 then
    raise exception '« % » : % relevés trouvés sur 178', 'Le Lux', v_count;
  end if;

  -- Urban Mode : 175 relevés du 2024-03-04 au 2026-03-13, fermée le 2026-03-14.
  if exists (select 1 from public.companies where name = 'Urban Mode' and closed_on = '2026-03-14') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Urban Mode', '2026-03-14';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Urban Mode' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Urban Mode' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-03-13'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Urban Mode', '2024-03-04', '2026-03-13';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Urban Mode', '{}'::text[], v_profile, '2026-03-14', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 33898::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 34033::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 33996::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 33958::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 33921::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 33964::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 34011::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 33974::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 33961::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 34458::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 34570::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 34532::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 34495::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 34457::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 34420::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 34383::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 34346::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 34309::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 34272::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 34318::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 34282::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 34245::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 34208::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 34171::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 34135::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 34118::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 34082::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 34046::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 34009::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 33973::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 34020::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 33984::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 34081::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 34009::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 33973::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 33937::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 34191::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 34155::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 34119::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 34138::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 34102::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 34066::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 34159::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 34124::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 34142::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 34106::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 34070::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 34000::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 33964::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 33929::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 33894::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 33859::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 33789::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 33754::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 34352::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 34307::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 34487::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 34956::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 35395::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 36043::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 36821::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 36771::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 36703::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 36279::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 36652::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 36571::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 36537::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 36450::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 36384::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 36351::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 36318::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 36371::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 36273::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 36208::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 36143::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 36098::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 36385::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 36790::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 36816::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 36801::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 36556::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 36663::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 36632::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 36397::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 36432::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 36701::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 36700::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 36746::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 37035::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 36975::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 37354::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 37342::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 37325::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 38245::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 38374::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 38465::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 38454::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 38558::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 38757::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 39152::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 39173::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 39200::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 39183::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 39275::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 39245::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 39147::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 39028::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 38947::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 38862::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 38832::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 38807::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 38595::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 38449::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 38257::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 38199::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 38063::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 38062::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 38061::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 37459::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 37505::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 37536::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 37284::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 37252::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 37146::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 37092::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 37117::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 37121::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 37095::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 37258::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 37231::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 37211::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 37158::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 37295::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 37269::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 37243::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 37216::bigint, null::bigint, null::integer),
    ('2025-08-16'::date, 37190::bigint, null::bigint, null::integer),
    ('2025-08-17'::date, 37164::bigint, null::bigint, null::integer),
    ('2025-08-18'::date, 37137::bigint, null::bigint, null::integer),
    ('2025-08-19'::date, 37111::bigint, null::bigint, null::integer),
    ('2025-08-20'::date, 37085::bigint, null::bigint, null::integer),
    ('2025-08-21'::date, 37059::bigint, null::bigint, null::integer),
    ('2025-08-22'::date, 37033::bigint, null::bigint, null::integer),
    ('2025-08-23'::date, 37007::bigint, null::bigint, null::integer),
    ('2025-08-24'::date, 37002::bigint, null::bigint, null::integer),
    ('2025-08-25'::date, 36996::bigint, null::bigint, null::integer),
    ('2025-08-26'::date, 36970::bigint, null::bigint, null::integer),
    ('2025-08-27'::date, 37009::bigint, null::bigint, null::integer),
    ('2025-08-29'::date, 36982::bigint, null::bigint, null::integer),
    ('2025-08-30'::date, 36956::bigint, null::bigint, null::integer),
    ('2025-09-01'::date, 36904::bigint, null::bigint, null::integer),
    ('2025-09-07'::date, 36750::bigint, null::bigint, null::integer),
    ('2025-09-11'::date, 36706::bigint, null::bigint, null::integer),
    ('2025-09-12'::date, 36719::bigint, null::bigint, null::integer),
    ('2025-09-13'::date, 36702::bigint, null::bigint, null::integer),
    ('2025-09-21'::date, 36663::bigint, null::bigint, null::integer),
    ('2025-09-25'::date, 36562::bigint, null::bigint, null::integer),
    ('2025-10-01'::date, 36412::bigint, null::bigint, null::integer),
    ('2025-10-09'::date, 36373::bigint, null::bigint, null::integer),
    ('2025-10-14'::date, 36249::bigint, null::bigint, null::integer),
    ('2025-10-22'::date, 36082::bigint, null::bigint, null::integer),
    ('2025-10-24'::date, 36266::bigint, null::bigint, null::integer),
    ('2025-10-25'::date, 36375::bigint, null::bigint, null::integer),
    ('2025-11-02'::date, 37585::bigint, null::bigint, null::integer),
    ('2025-11-10'::date, 37545::bigint, null::bigint, null::integer),
    ('2025-12-03'::date, 37447::bigint, null::bigint, null::integer),
    ('2025-12-10'::date, 37402::bigint, null::bigint, null::integer),
    ('2025-12-18'::date, 37556::bigint, null::bigint, null::integer),
    ('2025-12-19'::date, 37636::bigint, null::bigint, null::integer),
    ('2026-01-31'::date, 37859::bigint, null::bigint, null::integer),
    ('2026-02-19'::date, 37633::bigint, null::bigint, null::integer),
    ('2026-02-22'::date, 37664::bigint, null::bigint, null::integer),
    ('2026-02-26'::date, 37609::bigint, null::bigint, null::integer),
    ('2026-03-01'::date, 37539::bigint, null::bigint, null::integer),
    ('2026-03-13'::date, 14::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 175 then
    raise exception '« % » : % relevés trouvés sur 175', 'Urban Mode', v_count;
  end if;

  -- Armacham Factories : 175 relevés du 2024-03-04 au 2026-03-13, fermée le 2026-03-14.
  if exists (select 1 from public.companies where name = 'Armacham Factories' and closed_on = '2026-03-14') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Armacham Factories', '2026-03-14';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Armacham Factories' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Armacham Factories' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-03-13'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Armacham Factories', '2024-03-04', '2026-03-13';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Armacham Factories', '{}'::text[], v_profile, '2026-03-14', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 270464::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 270471::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 270407::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 270343::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 270328::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 270272::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 270225::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 270226::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 270180::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 270052::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 269988::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 269931::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 269870::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 269807::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 269856::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 269803::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 269756::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 269693::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 269629::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 269569::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 269512::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 269519::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 269500::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 269441::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 269406::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 269418::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 269361::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 269472::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 269456::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 269393::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 269337::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 269273::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 269214::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 269095::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 269032::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 268989::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 269039::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 268978::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 269091::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 269032::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 269080::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 269017::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 268954::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 268891::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 268765::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 268708::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 268705::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 268579::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 268668::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 268612::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 268869::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 268937::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 268818::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 268762::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 268357::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 268347::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 268250::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 267739::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 267066::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 267129::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 267091::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 267063::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 266941::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 266395::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 266286::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 266396::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 266335::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 266405::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 266308::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 266248::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 266188::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 266135::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 265991::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 265959::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 265963::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 265846::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 265752::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 265988::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 265819::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 265568::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 264875::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 264639::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 264594::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 264566::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 264559::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 264049::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 264080::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 264021::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 263935::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 263818::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 263780::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 263732::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 263684::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 263418::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 263090::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 263002::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 262947::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 262878::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 262760::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 262692::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 262545::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 262669::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 262503::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 262383::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 262369::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 262206::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 261948::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 261780::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 261887::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 261830::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 261699::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 261617::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 261540::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 261362::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 261292::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 261523::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 261411::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 261500::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 261100::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 261138::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 261109::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 260838::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 260744::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 260690::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 260731::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 260683::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 260628::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 260573::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 260883::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 260838::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 260739::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 260744::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 260907::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 260852::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 260797::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 260867::bigint, 19601975::bigint, 4::integer),
    ('2025-08-16'::date, 260814::bigint, 19591665::bigint, 4::integer),
    ('2025-08-17'::date, 260759::bigint, 19575665::bigint, 4::integer),
    ('2025-08-18'::date, 260717::bigint, 19613962::bigint, 4::integer),
    ('2025-08-19'::date, 260676::bigint, 19651962::bigint, 4::integer),
    ('2025-08-20'::date, 260675::bigint, 20251962::bigint, 4::integer),
    ('2025-08-21'::date, 260800::bigint, 20220962::bigint, 4::integer),
    ('2025-08-22'::date, 260769::bigint, 19799553::bigint, 4::integer),
    ('2025-08-23'::date, 260798::bigint, 19602303::bigint, 4::integer),
    ('2025-08-24'::date, 260792::bigint, 19154603::bigint, 4::integer),
    ('2025-08-25'::date, 260851::bigint, 19661703::bigint, 4::integer),
    ('2025-08-26'::date, 260796::bigint, 19633703::bigint, 4::integer),
    ('2025-08-27'::date, 260961::bigint, 20648453::bigint, 4::integer),
    ('2025-08-29'::date, 260857::bigint, 20227653::bigint, 4::integer),
    ('2025-08-30'::date, 260986::bigint, 21072653::bigint, 4::integer),
    ('2025-09-01'::date, 260960::bigint, 20237603::bigint, 4::integer),
    ('2025-09-07'::date, 260700::bigint, 20146753::bigint, 4::integer),
    ('2025-09-11'::date, 260542::bigint, 19286953::bigint, 4::integer),
    ('2025-09-12'::date, 260487::bigint, 19255953::bigint, 4::integer),
    ('2025-09-13'::date, 260448::bigint, 19297008::bigint, 4::integer),
    ('2025-09-21'::date, 260332::bigint, 19118668::bigint, 5::integer),
    ('2025-09-25'::date, 260152::bigint, 19098868::bigint, 5::integer),
    ('2025-10-01'::date, 259958::bigint, 19163668::bigint, 5::integer),
    ('2025-10-09'::date, 259712::bigint, 18439578::bigint, 5::integer),
    ('2025-10-14'::date, 259643::bigint, 19129999::bigint, 5::integer),
    ('2025-10-22'::date, 259432::bigint, 19228337::bigint, 5::integer),
    ('2025-10-24'::date, 259495::bigint, 19153629::bigint, 5::integer),
    ('2025-10-25'::date, 259441::bigint, 18952485::bigint, 5::integer),
    ('2025-11-02'::date, 259248::bigint, 19324822::bigint, 6::integer),
    ('2025-11-10'::date, 259272::bigint, 19847376::bigint, 6::integer),
    ('2025-12-03'::date, 258834::bigint, 21137121::bigint, 6::integer),
    ('2025-12-10'::date, 258677::bigint, 21168736::bigint, 6::integer),
    ('2025-12-18'::date, 258311::bigint, 20742566::bigint, 6::integer),
    ('2025-12-19'::date, 258258::bigint, 20719438::bigint, 6::integer),
    ('2026-01-31'::date, 257118::bigint, 20237795::bigint, 6::integer),
    ('2026-02-19'::date, 256504::bigint, 19314544::bigint, 5::integer),
    ('2026-02-22'::date, 256400::bigint, 19255609::bigint, 5::integer),
    ('2026-02-26'::date, 256276::bigint, 20237795::bigint, 5::integer),
    ('2026-03-01'::date, 256123::bigint, 19164701::bigint, 5::integer),
    ('2026-03-13'::date, 255700::bigint, 19353201::bigint, 5::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 175 then
    raise exception '« % » : % relevés trouvés sur 175', 'Armacham Factories', v_count;
  end if;

  -- Triple Pinte : 172 relevés du 2024-03-04 au 2026-02-22, fermée le 2026-02-26.
  if exists (select 1 from public.companies where name = 'Triple Pinte' and closed_on = '2026-02-26') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Triple Pinte', '2026-02-26';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Triple Pinte' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Triple Pinte' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-02-22'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Triple Pinte', '2024-03-04', '2026-02-22';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Triple Pinte', '{}'::text[], v_profile, '2026-02-26', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 16105::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 16097::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 16089::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 16081::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 16075::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 16067::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 16059::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 16051::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 16043::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 16027::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 16019::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 16012::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 16004::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 15996::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 15988::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 15980::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 15972::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 15965::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 15957::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 15949::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 15941::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 15933::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 15926::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 15918::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 15910::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 15902::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 15895::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 15887::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 15879::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 15871::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 15864::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 15856::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 15848::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 15833::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 15825::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 15818::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 15810::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 15802::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 15795::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 15787::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 15779::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 15772::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 15764::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 15757::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 15741::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 15734::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 15726::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 15711::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 15703::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 15696::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 15688::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 15681::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 15666::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 15658::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 15569::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 15542::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 15499::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 15236::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 15138::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 15116::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 15033::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 15016::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 15003::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 14942::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 14927::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 14918::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 14914::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 14906::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 14898::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 14899::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 14893::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 14883::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 14871::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 14861::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 14853::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 14865::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 14856::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 14809::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 14793::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 14767::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 14695::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 14640::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 14638::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 14605::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 14611::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 14607::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 14602::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 14600::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 14606::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 14604::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 14600::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 14599::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 14592::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 14579::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 14541::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 14534::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 14532::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 14525::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 14508::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 14501::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 14478::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 14439::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 14428::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 14426::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 14423::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 14408::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 14397::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 14388::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 14368::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 14366::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 14353::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 14323::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 14310::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 14225::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 14218::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 14187::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 14180::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 14172::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 14037::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 14035::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 14030::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 13975::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 13966::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 13947::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 13936::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 13925::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 13920::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 13914::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 13904::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 13898::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 13891::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 13883::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 13879::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 13874::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 13871::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 13866::bigint, 3501202::bigint, 2::integer),
    ('2025-08-16'::date, 13861::bigint, 3501202::bigint, 2::integer),
    ('2025-08-17'::date, 13855::bigint, 3501202::bigint, 2::integer),
    ('2025-08-18'::date, 13850::bigint, 3501202::bigint, 2::integer),
    ('2025-08-19'::date, 13845::bigint, 3501202::bigint, 2::integer),
    ('2025-08-20'::date, 13839::bigint, 3502602::bigint, 2::integer),
    ('2025-08-21'::date, 13834::bigint, 3502602::bigint, 2::integer),
    ('2025-08-22'::date, 13832::bigint, 3510352::bigint, 2::integer),
    ('2025-08-23'::date, 13826::bigint, 3513202::bigint, 2::integer),
    ('2025-08-24'::date, 13822::bigint, 3513652::bigint, 2::integer),
    ('2025-08-25'::date, 13818::bigint, 3519502::bigint, 2::integer),
    ('2025-08-26'::date, 13814::bigint, 3519952::bigint, 2::integer),
    ('2025-08-27'::date, 13810::bigint, 3524052::bigint, 2::integer),
    ('2025-08-29'::date, 13803::bigint, 3533152::bigint, 2::integer),
    ('2025-08-30'::date, 13798::bigint, 3534402::bigint, 2::integer),
    ('2025-09-01'::date, 13788::bigint, 3535652::bigint, 2::integer),
    ('2025-09-07'::date, 13767::bigint, 3561572::bigint, 3::integer),
    ('2025-09-11'::date, 13759::bigint, 3569812::bigint, 3::integer),
    ('2025-09-12'::date, 13756::bigint, 3571162::bigint, 3::integer),
    ('2025-09-13'::date, 13755::bigint, 3573062::bigint, 3::integer),
    ('2025-09-21'::date, 13735::bigint, 3572852::bigint, 3::integer),
    ('2025-09-25'::date, 13726::bigint, 3580752::bigint, 3::integer),
    ('2025-10-01'::date, 13706::bigint, 3576352::bigint, 2::integer),
    ('2025-10-09'::date, 13684::bigint, 3579292::bigint, 2::integer),
    ('2025-10-14'::date, 13665::bigint, 3568692::bigint, 2::integer),
    ('2025-10-22'::date, 13638::bigint, 3560232::bigint, 2::integer),
    ('2025-10-24'::date, 13630::bigint, 3551852::bigint, 2::integer),
    ('2025-10-25'::date, 13625::bigint, 3546402::bigint, 2::integer),
    ('2025-11-02'::date, 13604::bigint, 3555582::bigint, 2::integer),
    ('2025-11-10'::date, 13578::bigint, 3548282::bigint, 2::integer),
    ('2025-12-03'::date, 13503::bigint, 3584282::bigint, 1::integer),
    ('2025-12-10'::date, 13475::bigint, 3604882::bigint, 1::integer),
    ('2025-12-18'::date, 13442::bigint, 3623812::bigint, 1::integer),
    ('2025-12-19'::date, 13437::bigint, 3624312::bigint, 1::integer),
    ('2026-01-31'::date, 13236::bigint, 3652592::bigint, 1::integer),
    ('2026-02-19'::date, 13144::bigint, 3652592::bigint, 1::integer),
    ('2026-02-22'::date, 13130::bigint, 3652592::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 172 then
    raise exception '« % » : % relevés trouvés sur 172', 'Triple Pinte', v_count;
  end if;

  -- Valhalla : 171 relevés du 2024-03-04 au 2026-02-19, fermée le 2026-02-22.
  if exists (select 1 from public.companies where name = 'Valhalla' and closed_on = '2026-02-22') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Valhalla', '2026-02-22';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Valhalla' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Valhalla' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-02-19'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Valhalla', '2024-03-04', '2026-02-19';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Valhalla', '{}'::text[], v_profile, '2026-02-22', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 755::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 749::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 743::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 737::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 731::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 725::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 719::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 714::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 708::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 708::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 692::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 687::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 682::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 677::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 677::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 677::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 662::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 657::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 686::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 706::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 722::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 729::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 728::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 742::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 737::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 735::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 791::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 786::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 796::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 791::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 786::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 781::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 776::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 766::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 768::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 763::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 788::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 783::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 778::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 774::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 769::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 764::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 759::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 755::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 746::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 741::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 737::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 729::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 724::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 720::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 716::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 712::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 704::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 700::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 653::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 639::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 617::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 608::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 598::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 589::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 563::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 557::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 553::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 529::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 521::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 516::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 514::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 509::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 506::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 505::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 503::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 498::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 494::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 491::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 488::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 486::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 481::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 463::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 458::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 460::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 435::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 410::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 409::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 401::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 398::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 389::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 387::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 387::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 384::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 382::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 380::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 379::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 377::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 369::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 365::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 363::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 362::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 361::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 358::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 356::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 352::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 344::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 341::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 339::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 338::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 335::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 336::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 338::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 338::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 337::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 335::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 329::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 328::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 338::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 352::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 355::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 354::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 353::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 342::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 342::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 341::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 338::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 342::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 342::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 341::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 340::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 340::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 339::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 338::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 338::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 336::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 335::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 335::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 334::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 334::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 333::bigint, 146503::bigint, 1::integer),
    ('2025-08-16'::date, 333::bigint, 146503::bigint, 1::integer),
    ('2025-08-17'::date, 332::bigint, 146503::bigint, 1::integer),
    ('2025-08-18'::date, 332::bigint, 146503::bigint, 1::integer),
    ('2025-08-19'::date, 331::bigint, 146503::bigint, 1::integer),
    ('2025-08-20'::date, 331::bigint, 146503::bigint, 1::integer),
    ('2025-08-21'::date, 330::bigint, 146503::bigint, 1::integer),
    ('2025-08-22'::date, 330::bigint, 146503::bigint, 1::integer),
    ('2025-08-23'::date, 329::bigint, 146503::bigint, 1::integer),
    ('2025-08-24'::date, 329::bigint, 146503::bigint, 1::integer),
    ('2025-08-25'::date, 328::bigint, 146503::bigint, 1::integer),
    ('2025-08-26'::date, 328::bigint, 146503::bigint, 1::integer),
    ('2025-08-27'::date, 327::bigint, 146503::bigint, 1::integer),
    ('2025-08-29'::date, 326::bigint, 146503::bigint, 1::integer),
    ('2025-08-30'::date, 326::bigint, 146503::bigint, 1::integer),
    ('2025-09-01'::date, 325::bigint, 146503::bigint, 1::integer),
    ('2025-09-07'::date, 322::bigint, 146503::bigint, 1::integer),
    ('2025-09-11'::date, 320::bigint, 146503::bigint, 1::integer),
    ('2025-09-12'::date, 320::bigint, 146503::bigint, 1::integer),
    ('2025-09-13'::date, 319::bigint, 146503::bigint, 1::integer),
    ('2025-09-21'::date, 315::bigint, 146503::bigint, 1::integer),
    ('2025-09-25'::date, 314::bigint, 146503::bigint, 1::integer),
    ('2025-10-01'::date, 311::bigint, 146503::bigint, 1::integer),
    ('2025-10-09'::date, 307::bigint, 146503::bigint, 1::integer),
    ('2025-10-14'::date, 305::bigint, 146503::bigint, 1::integer),
    ('2025-10-22'::date, 302::bigint, 146503::bigint, 1::integer),
    ('2025-10-24'::date, 301::bigint, 146503::bigint, 1::integer),
    ('2025-10-25'::date, 301::bigint, 146503::bigint, 1::integer),
    ('2025-11-02'::date, 299::bigint, 147703::bigint, 1::integer),
    ('2025-11-10'::date, 296::bigint, 147703::bigint, 1::integer),
    ('2025-12-03'::date, 287::bigint, 147703::bigint, 1::integer),
    ('2025-12-10'::date, 284::bigint, 147703::bigint, 1::integer),
    ('2025-12-18'::date, 281::bigint, 147703::bigint, 1::integer),
    ('2025-12-19'::date, 281::bigint, 147703::bigint, 1::integer),
    ('2026-01-31'::date, 266::bigint, 147703::bigint, 1::integer),
    ('2026-02-19'::date, 260::bigint, 147703::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 171 then
    raise exception '« % » : % relevés trouvés sur 171', 'Valhalla', v_count;
  end if;

  -- La plume Kalros : 170 relevés du 2024-03-04 au 2026-01-31, fermée le 2026-02-19.
  if exists (select 1 from public.companies where name = 'La plume Kalros' and closed_on = '2026-02-19') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'La plume Kalros', '2026-02-19';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'La plume Kalros' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'La plume Kalros' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2026-01-31'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'La plume Kalros', '2024-03-04', '2026-01-31';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('La plume Kalros', '{}'::text[], v_profile, '2026-02-19', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 9387::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 9363::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 10347::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 10325::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 10303::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 10289::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 11371::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 11377::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 13084::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 13077::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 13052::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 13029::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 12995::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 12963::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 12947::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 12914::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 12899::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 12984::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 12956::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 12929::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 12907::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 12880::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 12858::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 12829::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 12797::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 13268::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 13330::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 13302::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 13269::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 13850::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 13816::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 13783::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 15585::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 15536::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 15503::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 15466::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 15429::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 15392::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 16406::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 16367::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 16328::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 16289::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 16283::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 16245::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 16173::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 16135::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 16097::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 17081::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 17041::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 17002::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 16963::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 16924::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 16846::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 16963::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 16611::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 16514::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 16457::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 19323::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 20291::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 20408::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 19929::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 20084::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 20019::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 20256::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 20141::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 20089::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 20057::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 19953::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 20063::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 20029::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 20000::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 19940::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 19858::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 19817::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 19773::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 19741::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 19680::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 19387::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 19260::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 19104::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 19264::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 18902::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 18874::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 18643::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 18565::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 18542::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 18488::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 18461::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 18381::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 18328::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 18280::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 18384::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 18332::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 18527::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 18218::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 18167::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 18142::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 18368::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 18267::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 18217::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 18073::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 17807::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 17713::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 17775::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 17751::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 17637::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 17499::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 17431::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 17318::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 17296::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 17229::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 17034::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 16926::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 16469::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 16389::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 16172::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 16133::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 16094::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 15375::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 15358::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 15340::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 15150::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 15115::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 15048::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 15014::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 14980::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 14964::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 14947::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 14914::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 14897::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 14864::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 14832::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 14815::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 14799::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 14783::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 14766::bigint, 4695580::bigint, 1::integer),
    ('2025-08-16'::date, 14750::bigint, 4695580::bigint, 1::integer),
    ('2025-08-17'::date, 14734::bigint, 4695580::bigint, 1::integer),
    ('2025-08-18'::date, 14718::bigint, 4695580::bigint, 1::integer),
    ('2025-08-19'::date, 14702::bigint, 4695580::bigint, 1::integer),
    ('2025-08-20'::date, 14685::bigint, 4695580::bigint, 1::integer),
    ('2025-08-21'::date, 14669::bigint, 4695580::bigint, 1::integer),
    ('2025-08-22'::date, 14657::bigint, 4698630::bigint, 1::integer),
    ('2025-08-23'::date, 14641::bigint, 4698630::bigint, 1::integer),
    ('2025-08-24'::date, 14625::bigint, 4698630::bigint, 1::integer),
    ('2025-08-25'::date, 14609::bigint, 4698630::bigint, 1::integer),
    ('2025-08-26'::date, 14593::bigint, 4698630::bigint, 1::integer),
    ('2025-08-27'::date, 14577::bigint, 4698630::bigint, 1::integer),
    ('2025-08-29'::date, 14546::bigint, 4698630::bigint, 1::integer),
    ('2025-08-30'::date, 14530::bigint, 4698630::bigint, 1::integer),
    ('2025-09-01'::date, 14498::bigint, 4698630::bigint, 1::integer),
    ('2025-09-07'::date, 14405::bigint, 4698630::bigint, 1::integer),
    ('2025-09-11'::date, 14344::bigint, 4698630::bigint, 1::integer),
    ('2025-09-12'::date, 14328::bigint, 4698630::bigint, 1::integer),
    ('2025-09-13'::date, 14313::bigint, 4698630::bigint, 1::integer),
    ('2025-09-21'::date, 14192::bigint, 4698630::bigint, 1::integer),
    ('2025-09-25'::date, 14132::bigint, 4698630::bigint, 1::integer),
    ('2025-10-01'::date, 14253::bigint, 4738630::bigint, 1::integer),
    ('2025-10-09'::date, 14414::bigint, 4768630::bigint, 1::integer),
    ('2025-10-14'::date, 14650::bigint, 4795630::bigint, 1::integer),
    ('2025-10-22'::date, 14530::bigint, 4795630::bigint, 1::integer),
    ('2025-10-24'::date, 14500::bigint, 4795630::bigint, 1::integer),
    ('2025-10-25'::date, 14485::bigint, 4795630::bigint, 1::integer),
    ('2025-11-02'::date, 14368::bigint, 4795630::bigint, 1::integer),
    ('2025-11-10'::date, 14253::bigint, 4795630::bigint, 1::integer),
    ('2025-12-03'::date, 14389::bigint, 5027761::bigint, 1::integer),
    ('2025-12-10'::date, 14371::bigint, 129212::bigint, 1::integer),
    ('2025-12-18'::date, 14259::bigint, 129212::bigint, 1::integer),
    ('2025-12-19'::date, 14246::bigint, 129212::bigint, 1::integer),
    ('2026-01-31'::date, 13677::bigint, 129212::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 170 then
    raise exception '« % » : % relevés trouvés sur 170', 'La plume Kalros', v_count;
  end if;

  -- Manticore : 122 relevés du 2024-03-04 au 2025-07-23, fermée le 2025-07-25.
  if exists (select 1 from public.companies where name = 'Manticore' and closed_on = '2025-07-25') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Manticore', '2025-07-25';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Manticore' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Manticore' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-07-23'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Manticore', '2024-03-04', '2025-07-23';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Manticore', '{}'::text[], v_profile, '2025-07-25', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 32104::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 32073::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 32043::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 32012::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 31982::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 31952::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 31921::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 31891::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 31861::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 31800::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 31770::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 31740::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 31710::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 31681::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 31651::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 31621::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 31591::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 31562::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 31532::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 31502::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 31473::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 31443::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 31414::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 31385::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 31355::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 31326::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 31297::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 31268::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 31239::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 33903::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 35031::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 34998::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 34966::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 34901::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 34869::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 34837::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 34805::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 34773::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 34741::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 34709::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 34677::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 34645::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 34613::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 34582::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 34591::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 34560::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 34528::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 34538::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 34507::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 34475::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 34444::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 34413::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 34351::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 34319::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 33920::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 34245::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 34555::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 36220::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 36123::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 36003::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 35617::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 35940::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 36298::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 36321::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 36174::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 36086::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 36057::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 35970::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 35912::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 35884::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 35855::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 35769::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 35683::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 35626::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 35570::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 35513::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 35429::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 35067::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 35153::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 35016::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 36326::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 35998::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 35971::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 36432::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 36760::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 36434::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 36380::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 36354::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 36273::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 36220::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 36167::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 36114::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 36061::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 37649::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 39919::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 39861::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 39832::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 40464::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 40721::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 40913::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 40738::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 40633::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 40801::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 40715::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 40686::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 40543::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 40374::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 40290::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 40150::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 40122::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 40039::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 40236::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 40099::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 39651::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 39544::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 39254::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 39201::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 39200::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 39052::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 39026::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 39011::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 2::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 122 then
    raise exception '« % » : % relevés trouvés sur 122', 'Manticore', v_count;
  end if;

  -- Armacham Design : 152 relevés du 2024-03-04 au 2025-09-07, fermée le 2025-09-11.
  if exists (select 1 from public.companies where name = 'Armacham Design' and closed_on = '2025-09-11') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Armacham Design', '2025-09-11';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Armacham Design' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Armacham Design' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-09-07'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Armacham Design', '2024-03-04', '2025-09-07';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Armacham Design', '{}'::text[], v_profile, '2025-09-11', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 16529::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 16519::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 16510::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 16501::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 16491::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 16482::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 16473::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 16464::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 16454::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 16436::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 16427::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 16422::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 16413::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 16404::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 16394::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 16385::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 16377::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 16368::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 16359::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 16350::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 16341::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 16332::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 16323::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 16313::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 16304::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 16295::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 16286::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 16277::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 16268::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 16259::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 16250::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 16241::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 16232::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 16214::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 16205::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 16196::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 16187::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 16178::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 16170::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 16161::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 16152::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 16143::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 16134::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 16125::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 16107::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 16098::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 16090::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 16072::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 16063::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 16054::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 16046::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 16037::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 16019::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 16011::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 15898::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 15863::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 15803::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 15540::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 15403::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 15371::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 15293::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 15269::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 15259::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 15162::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 15123::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 15100::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 15092::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 15069::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 15054::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 15051::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 15044::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 15021::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 15003::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 14989::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 14974::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 14958::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 14936::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 14839::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 14809::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 14772::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 14627::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 14463::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 14456::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 14393::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 14372::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 14290::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 14276::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 14270::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 14249::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 14235::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 14222::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 14208::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 14195::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 14158::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 14092::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 14119::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 14125::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 14750::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 14945::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 15034::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 14994::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 14975::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 14948::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 14927::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 14920::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 14887::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 15235::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 15214::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 15179::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 15172::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 16210::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 17055::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 17016::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 16849::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 16818::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 16735::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 16720::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 16705::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 16417::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 16410::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 16403::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 16330::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 16316::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 16288::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 16273::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 16259::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 16252::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 16245::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 16232::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 16225::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 16210::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 16196::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 16189::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 16182::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 16175::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 16168::bigint, 1021863::bigint, 3::integer),
    ('2025-08-16'::date, 16161::bigint, 1013863::bigint, 3::integer),
    ('2025-08-17'::date, 16155::bigint, 1003863::bigint, 3::integer),
    ('2025-08-18'::date, 16148::bigint, 1003863::bigint, 3::integer),
    ('2025-08-19'::date, 16141::bigint, 995363::bigint, 3::integer),
    ('2025-08-20'::date, 16140::bigint, 1000363::bigint, 3::integer),
    ('2025-08-21'::date, 16133::bigint, 984613::bigint, 3::integer),
    ('2025-08-22'::date, 16127::bigint, 967363::bigint, 3::integer),
    ('2025-08-23'::date, 16120::bigint, 950613::bigint, 3::integer),
    ('2025-08-24'::date, 16113::bigint, 934863::bigint, 3::integer),
    ('2025-08-25'::date, 16106::bigint, 924863::bigint, 3::integer),
    ('2025-08-26'::date, 16099::bigint, 914863::bigint, 3::integer),
    ('2025-08-27'::date, 16092::bigint, 905863::bigint, 3::integer),
    ('2025-08-29'::date, 16078::bigint, 905863::bigint, 3::integer),
    ('2025-08-30'::date, 16071::bigint, 905863::bigint, 3::integer),
    ('2025-09-01'::date, 16057::bigint, 905863::bigint, 3::integer),
    ('2025-09-07'::date, 16016::bigint, 859613::bigint, 3::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 152 then
    raise exception '« % » : % relevés trouvés sur 152', 'Armacham Design', v_count;
  end if;

  -- Armacham Terra : 118 relevés du 2024-03-04 au 2025-06-01, fermée le 2025-07-10.
  if exists (select 1 from public.companies where name = 'Armacham Terra' and closed_on = '2025-07-10') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Armacham Terra', '2025-07-10';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Armacham Terra' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Armacham Terra' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-06-01'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Armacham Terra', '2024-03-04', '2025-06-01';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Armacham Terra', '{}'::text[], v_profile, '2025-07-10', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 54442::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 54352::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 54262::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 54172::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 54083::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 53994::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 53905::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 53816::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 53728::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 53552::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 53465::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 53378::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 53291::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 53205::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 53118::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 53032::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 52947::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 52861::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 52776::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 52691::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 52607::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 52523::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 52439::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 52355::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 52271::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 52188::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 52105::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 52022::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 51940::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 51858::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 51776::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 51694::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 51613::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 51451::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 51370::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 51290::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 51210::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 51130::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 51050::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 50971::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 50891::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 50813::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 50734::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 50655::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 50499::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 50422::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 50344::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 50190::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 50113::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 50037::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 50204::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 50128::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 49976::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 49900::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 48936::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 48647::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 48149::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 44869::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 43854::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 43621::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 42883::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 42716::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 42606::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 41901::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 41636::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 41484::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 41432::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 41284::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 41181::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 41129::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 41078::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 40934::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 40782::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 40681::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 40581::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 40547::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 40399::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 39767::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 39576::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 40532::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 39589::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 38556::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 38513::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 38157::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 38031::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 37551::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 37469::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 37429::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 37306::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 37224::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 37146::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 37170::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 37089::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 36842::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 36373::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 36295::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 36257::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 36181::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 36554::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 36582::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 36520::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 36622::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 36471::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 36564::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 36527::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 36361::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 37734::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 37620::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 37431::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 37394::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 37282::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 36951::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 36769::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 35989::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 35850::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 35476::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 35408::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 35341::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 118 then
    raise exception '« % » : % relevés trouvés sur 118', 'Armacham Terra', v_count;
  end if;

  -- Deck'Style : 118 relevés du 2024-03-04 au 2025-06-01, fermée le 2025-07-10.
  if exists (select 1 from public.companies where name = 'Deck''Style' and closed_on = '2025-07-10') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Deck''Style', '2025-07-10';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Deck''Style' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Deck''Style' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-06-01'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Deck''Style', '2024-03-04', '2025-06-01';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Deck''Style', '{}'::text[], v_profile, '2025-07-10', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 58089::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 57989::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 57889::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 57790::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 57691::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 57593::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 57495::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 57397::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 57300::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 57106::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 57009::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 56913::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 56817::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 56722::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 56627::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 56547::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 56452::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 56358::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 56264::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 56170::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 56077::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 55989::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 55896::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 55804::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 55712::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 56136::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 56043::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 55951::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 55860::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 55768::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 55677::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 55586::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 55496::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 55575::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 55485::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 55396::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 55311::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 55222::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 55142::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 55054::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 54965::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 54877::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 54789::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 54702::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 54528::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 54441::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 54355::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 54183::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 54097::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 54012::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 53927::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 53842::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 53673::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 53589::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 52521::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 52434::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 51885::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 48988::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 47892::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 47635::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 47355::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 47190::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 47064::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 46265::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 45964::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 45786::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 45727::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 45550::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 45433::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 45375::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 45317::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 45143::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 44971::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 44857::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 44744::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 44631::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 44463::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 43893::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 43941::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 44559::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 43642::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 43987::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 43936::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 43530::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 43380::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 42932::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 42835::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 42787::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 42643::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 42548::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 42453::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 42358::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 42264::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 41845::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 41300::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 41211::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 41166::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 41077::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 40901::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 40813::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 40552::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 40082::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 39913::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 39788::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 39747::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 39540::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 39295::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 39174::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 38973::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 38933::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 38814::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 38467::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 38273::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 37444::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 37298::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 36900::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 36828::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 36757::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 118 then
    raise exception '« % » : % relevés trouvés sur 118', 'Deck''Style', v_count;
  end if;

  -- Apex Industries : 115 relevés du 2024-03-04 au 2025-05-17, fermée le 2025-05-28.
  if exists (select 1 from public.companies where name = 'Apex Industries' and closed_on = '2025-05-28') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Apex Industries', '2025-05-28';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Apex Industries' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Apex Industries' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-05-17'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Apex Industries', '2024-03-04', '2025-05-17';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Apex Industries', '{}'::text[], v_profile, '2025-05-28', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 2313::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 2307::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 2301::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 2296::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 2290::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 2285::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 2280::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 2274::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 2269::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 2258::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 2253::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 2248::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 2242::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 2237::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 2232::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 2227::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 2222::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 2217::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 2211::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 2206::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 2201::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 2196::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 2191::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 2186::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 2181::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 2176::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 2172::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 2167::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 16407::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 16371::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 16334::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 16297::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 16261::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 16189::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 16153::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 16118::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 16082::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 16047::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 16012::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 15976::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 15942::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 15907::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 15872::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 15838::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 15769::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 15735::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 15702::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 15634::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 15601::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 15568::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 15535::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 15502::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 15436::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 15403::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 14992::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 14870::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 14661::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 13323::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 12923::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 12832::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 12545::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 12481::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 12438::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 12169::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 12068::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 12009::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 11989::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 11930::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 11891::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 11872::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 11853::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 11795::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 11738::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 12316::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 12277::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 12238::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 12179::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 11934::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 11860::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 11769::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 11419::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 11042::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 11026::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 10886::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 10840::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 10659::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 10630::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 10615::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 10571::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 10542::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 10513::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 10485::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 10456::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 10330::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 10166::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 10139::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 10125::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 10099::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 10046::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 10020::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 9942::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 9803::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 9753::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 9716::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 9704::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 9643::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 9571::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 9535::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 9476::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 9465::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 9430::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 9327::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 9271::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 9031::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 8989::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 115 then
    raise exception '« % » : % relevés trouvés sur 115', 'Apex Industries', v_count;
  end if;

  -- ShadyChrome : 113 relevés du 2024-03-04 au 2025-04-21, fermée le 2025-05-13.
  if exists (select 1 from public.companies where name = 'ShadyChrome' and closed_on = '2025-05-13') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'ShadyChrome', '2025-05-13';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'ShadyChrome' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'ShadyChrome' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-04-21'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'ShadyChrome', '2024-03-04', '2025-04-21';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('ShadyChrome', '{}'::text[], v_profile, '2025-05-13', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 38844::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 38370::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 37903::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 37446::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 37000::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 36565::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 36140::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 35724::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 35318::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 34533::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 34154::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 44217::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 51699::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 52106::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 51558::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 51021::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 50495::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 49980::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 51293::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 50780::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 50277::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 49784::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 49301::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 48827::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 48362::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 47906::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 47458::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 47019::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 47706::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 47273::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 46847::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 46429::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 46018::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 46783::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 46379::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 45983::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 45593::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 45210::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 44833::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 44463::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 44098::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 43740::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 43387::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 45600::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 44882::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 44531::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 44186::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 45573::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 45227::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 44887::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 44552::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 44222::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 43577::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 43261::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 40133::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 39097::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 37407::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 34670::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 32096::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 31545::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 35976::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 35542::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 35259::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 33523::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 32900::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 32537::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 32418::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 32065::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 31835::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 31720::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 31607::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 31590::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 31259::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 31441::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 31224::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 31010::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 30695::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 29399::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 29023::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 28565::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 31114::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 29126::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 29876::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 29150::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 28915::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 28014::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 27869::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 27797::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 27584::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 27444::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 27305::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 27167::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 27031::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 26435::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 25680::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 25558::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 25497::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 25566::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 25330::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 26142::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 25784::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 26604::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 26368::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 26194::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 26137::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 25853::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 25521::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 25677::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 26723::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 26667::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 26500::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 26011::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 25747::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 113 then
    raise exception '« % » : % relevés trouvés sur 113', 'ShadyChrome', v_count;
  end if;

  -- Le Nomade : 100 relevés du 2024-03-04 au 2025-02-18, fermée le 2025-02-24.
  if exists (select 1 from public.companies where name = 'Le Nomade' and closed_on = '2025-02-24') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Le Nomade', '2025-02-24';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Le Nomade' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Le Nomade' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-02-18'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Le Nomade', '2024-03-04', '2025-02-18';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Le Nomade', '{}'::text[], v_profile, '2025-02-24', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 3145::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 3140::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 3134::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 3132::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 3127::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 3121::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 3118::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 3112::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 3108::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 3101::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 3096::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 3101::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 3096::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 3096::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 3115::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 3119::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 3115::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 3113::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 3115::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 3115::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 3112::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 3110::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 3110::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 3105::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 3100::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 3102::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 3097::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 3092::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 3090::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 3087::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 3082::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 3077::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 3072::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 3062::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 3060::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 3059::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 3059::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 3054::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 3060::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 3055::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 3054::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 3051::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 3049::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 3055::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 3055::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 3053::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 3052::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 3062::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 3066::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 3063::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 3062::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 3060::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 3057::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 3057::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 3064::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 3065::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 3048::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 2968::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 2922::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 2910::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 2897::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 2886::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 2881::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 2851::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 2837::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 2829::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 2827::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 2817::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 2811::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 2807::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 2804::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 2793::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 2843::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 2837::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 2830::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 2823::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 2814::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 2777::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 2767::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 2754::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 2762::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 2709::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 2708::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 2692::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 2686::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 2681::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 2675::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 2682::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 2681::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 2677::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 2671::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 2679::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 2682::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 2679::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 2660::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 2654::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 2651::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 2651::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 2640::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 2637::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 100 then
    raise exception '« % » : % relevés trouvés sur 100', 'Le Nomade', v_count;
  end if;

  -- L'Hadar : 98 relevés du 2024-03-04 au 2025-02-12, fermée le 2025-02-16.
  if exists (select 1 from public.companies where name = 'L''Hadar' and closed_on = '2025-02-16') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'L''Hadar', '2025-02-16';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'L''Hadar' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'L''Hadar' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-02-12'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'L''Hadar', '2024-03-04', '2025-02-12';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('L''Hadar', '{}'::text[], v_profile, '2025-02-16', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 71119::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 70625::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 70138::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 69658::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 69184::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 68716::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 68255::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 67800::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 67351::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 66521::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 66039::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 65613::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 65192::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 64777::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 64367::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 63962::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 63562::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 63168::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 62778::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 62393::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 62012::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 61636::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 61265::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 60898::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 60536::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 60178::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 59824::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 59474::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 59128::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 58786::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 58448::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 58114::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 57784::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 57135::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 56816::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 56500::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 56188::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 55879::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 55574::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 55272::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 54973::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 54677::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 54385::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 54096::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 53526::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 53246::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 52969::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 52423::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 52154::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 51888::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 51624::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 51364::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 50850::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 50597::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 47523::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 46651::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 45200::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 36982::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 34829::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 34358::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 32913::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 32596::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 32389::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 31101::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 30633::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 30358::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 30268::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 30000::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 29824::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 29737::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 29650::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 29393::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 29140::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 28974::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 28810::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 28648::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 28408::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 27412::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 27120::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 26763::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 25425::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 24043::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 23986::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 23487::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 23326::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 22701::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 22600::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 22550::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 22401::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 22303::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 22205::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 22109::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 22013::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 21592::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 21056::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 20969::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 20926::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 20840::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 98 then
    raise exception '« % » : % relevés trouvés sur 98', 'L''Hadar', v_count;
  end if;

  -- La Condorienne : 91 relevés du 2024-03-04 au 2025-01-13, fermée le 2025-01-15.
  if exists (select 1 from public.companies where name = 'La Condorienne' and closed_on = '2025-01-15') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'La Condorienne', '2025-01-15';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'La Condorienne' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'La Condorienne' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2025-01-13'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'La Condorienne', '2024-03-04', '2025-01-13';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('La Condorienne', '{}'::text[], v_profile, '2025-01-15', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 130622::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 130995::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 130863::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 130734::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 130602::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 130873::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 130742::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 130961::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 130836::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 130574::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 130444::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 130313::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 130183::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 130054::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 129926::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 129882::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 129754::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 129626::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 129504::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 129574::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 129450::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 129323::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 129207::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 129079::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 128955::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 128828::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 128701::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 128579::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 128453::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 128327::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 128202::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 128077::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 127954::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 127705::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 127581::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 127456::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 127332::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 127209::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 127085::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 126962::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 126839::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 126716::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 126597::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 126475::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 126234::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 126113::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 125996::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 125754::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 125633::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 125512::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 125393::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 125273::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 125048::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 124929::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 123424::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 122964::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 122177::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 120169::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 120438::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 120024::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 118861::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 118562::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 118380::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 118698::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 118200::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 119717::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 119987::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 120220::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 120019::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 119918::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 119819::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 119518::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 119218::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 119027::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 119695::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 119496::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 119199::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 117936::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 117553::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 117074::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 115520::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 114191::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 114101::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 113982::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 114003::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 117010::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 116878::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 117095::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 116833::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 116654::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 126914::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 91 then
    raise exception '« % » : % relevés trouvés sur 91', 'La Condorienne', v_count;
  end if;

  -- Guns N' Squirrels : 84 relevés du 2024-03-04 au 2024-12-19, fermée le 2024-12-22.
  if exists (select 1 from public.companies where name = 'Guns N'' Squirrels' and closed_on = '2024-12-22') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Guns N'' Squirrels', '2024-12-22';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Guns N'' Squirrels' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Guns N'' Squirrels' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2024-12-19'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Guns N'' Squirrels', '2024-03-04', '2024-12-19';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Guns N'' Squirrels', '{}'::text[], v_profile, '2024-12-22', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 24201::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 24050::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 23902::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 23755::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 23610::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 23637::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 23507::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 23366::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 23227::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 22954::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 22840::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 22707::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 22749::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 22782::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 23555::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 23421::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 23295::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 23173::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 23043::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 23212::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 23103::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 22985::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 22882::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 22758::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 22635::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 22529::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 22417::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 22297::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 22179::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 22063::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 21947::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 21833::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 21728::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 21659::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 21829::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 21721::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 21612::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 21503::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 21396::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 21289::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 21201::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 21097::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 21119::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 21026::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 20939::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 20848::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 20748::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 20914::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 20818::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 20721::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 20624::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 20677::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 20486::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 20392::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 20269::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 20146::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 20224::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 21606::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 21616::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 21346::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 22283::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 22447::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 22469::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 21975::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 21677::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 21519::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 21484::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 21387::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 21334::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 21425::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 21366::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 21366::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 21190::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 21155::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 21186::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 21376::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 21269::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 20876::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 20775::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 20723::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 21452::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 22340::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 22289::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 22207::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 84 then
    raise exception '« % » : % relevés trouvés sur 84', 'Guns N'' Squirrels', v_count;
  end if;

  -- TopImo : 82 relevés du 2024-03-04 au 2024-12-09, fermée le 2024-12-10.
  if exists (select 1 from public.companies where name = 'TopImo' and closed_on = '2024-12-10') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'TopImo', '2024-12-10';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'TopImo' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'TopImo' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2024-12-09'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'TopImo', '2024-03-04', '2024-12-09';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('TopImo', '{}'::text[], v_profile, '2024-12-10', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 70::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 69::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 68::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 68::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 67::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 67::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 67::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 66::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 66::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 65::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 63::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 62::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 62::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 61::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 61::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 61::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 61::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 60::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 59::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 59::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 59::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 59::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 58::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 58::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 57::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 57::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 82 then
    raise exception '« % » : % relevés trouvés sur 82', 'TopImo', v_count;
  end if;

  -- Ex Machina : 65 relevés du 2024-03-04 au 2024-09-09, fermée le 2024-09-12.
  if exists (select 1 from public.companies where name = 'Ex Machina' and closed_on = '2024-09-12') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Ex Machina', '2024-09-12';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Ex Machina' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Ex Machina' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2024-09-09'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Ex Machina', '2024-03-04', '2024-09-09';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Ex Machina', '{}'::text[], v_profile, '2024-09-12', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 74100::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 73963::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 74017::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 73975::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 73933::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 73892::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 73850::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 73808::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 73767::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 73684::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 73643::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 73601::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 73560::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 73519::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 73478::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 73437::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 73396::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 73355::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 73314::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 73273::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 73232::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 73191::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 73150::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 73109::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 73069::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 73028::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 72987::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 72947::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 72906::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 72866::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 72825::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 72785::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 72745::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 72664::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 72624::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 72584::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 72544::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 72503::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 72463::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 72423::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 72384::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 72344::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 72304::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 72264::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 72184::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 72145::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 72105::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 72026::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 71986::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 71947::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 71908::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 71868::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 71790::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 71750::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 71244::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 71090::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 70821::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 68960::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 68350::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 68208::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 67750::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 67645::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 67575::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 67126::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 66955::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 65 then
    raise exception '« % » : % relevés trouvés sur 65', 'Ex Machina', v_count;
  end if;

  -- Donnestyle : 64 relevés du 2024-03-04 au 2024-09-04, fermée le 2024-09-09.
  if exists (select 1 from public.companies where name = 'Donnestyle' and closed_on = '2024-09-09') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Donnestyle', '2024-09-09';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Donnestyle' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Donnestyle' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2024-09-04'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Donnestyle', '2024-03-04', '2024-09-04';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Donnestyle', '{}'::text[], v_profile, '2024-09-09', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 36342::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 36324::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 36328::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 36311::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 36294::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 36289::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 36272::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 36255::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 36268::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 36233::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 36252::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 36241::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 36232::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 36215::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 36198::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 36188::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 36248::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 36231::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 36224::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 36207::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 36216::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 36214::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 36197::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 36195::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 36195::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 36178::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 36195::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 36239::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 36222::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 36228::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 36248::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 36241::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 36227::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 36246::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 36230::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 36213::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 36278::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 36266::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 36261::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 36266::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 36250::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 36241::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 36269::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 36261::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 36268::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 36251::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 36249::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 36255::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 36239::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 36222::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 36227::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 36210::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 36176::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 36160::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 36042::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 36016::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 36094::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 35968::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 35799::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 35846::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 35920::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 36183::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 36199::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 36322::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 64 then
    raise exception '« % » : % relevés trouvés sur 64', 'Donnestyle', v_count;
  end if;

  -- Le Squirk : 58 relevés du 2024-03-04 au 2024-07-14, fermée le 2024-07-31.
  if exists (select 1 from public.companies where name = 'Le Squirk' and closed_on = '2024-07-31') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Le Squirk', '2024-07-31';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Le Squirk' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Le Squirk' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-03-04' and '2024-07-14'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Le Squirk', '2024-03-04', '2024-07-14';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Le Squirk', '{}'::text[], v_profile, '2024-07-31', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-03-04'::date, 5640::bigint, null::bigint, null::integer),
    ('2024-03-05'::date, 5637::bigint, null::bigint, null::integer),
    ('2024-03-06'::date, 5634::bigint, null::bigint, null::integer),
    ('2024-03-07'::date, 5630::bigint, null::bigint, null::integer),
    ('2024-03-08'::date, 5627::bigint, null::bigint, null::integer),
    ('2024-03-09'::date, 5623::bigint, null::bigint, null::integer),
    ('2024-03-10'::date, 5620::bigint, null::bigint, null::integer),
    ('2024-03-11'::date, 5617::bigint, null::bigint, null::integer),
    ('2024-03-12'::date, 5613::bigint, null::bigint, null::integer),
    ('2024-03-14'::date, 5606::bigint, null::bigint, null::integer),
    ('2024-03-15'::date, 5603::bigint, null::bigint, null::integer),
    ('2024-03-16'::date, 5600::bigint, null::bigint, null::integer),
    ('2024-03-17'::date, 5596::bigint, null::bigint, null::integer),
    ('2024-03-18'::date, 5593::bigint, null::bigint, null::integer),
    ('2024-03-19'::date, 5590::bigint, null::bigint, null::integer),
    ('2024-03-20'::date, 5586::bigint, null::bigint, null::integer),
    ('2024-03-21'::date, 5583::bigint, null::bigint, null::integer),
    ('2024-03-22'::date, 5579::bigint, null::bigint, null::integer),
    ('2024-03-23'::date, 5576::bigint, null::bigint, null::integer),
    ('2024-03-24'::date, 5573::bigint, null::bigint, null::integer),
    ('2024-03-25'::date, 5569::bigint, null::bigint, null::integer),
    ('2024-03-26'::date, 5566::bigint, null::bigint, null::integer),
    ('2024-03-27'::date, 5563::bigint, null::bigint, null::integer),
    ('2024-03-28'::date, 5559::bigint, null::bigint, null::integer),
    ('2024-03-29'::date, 5556::bigint, null::bigint, null::integer),
    ('2024-03-30'::date, 5553::bigint, null::bigint, null::integer),
    ('2024-03-31'::date, 5550::bigint, null::bigint, null::integer),
    ('2024-04-01'::date, 5546::bigint, null::bigint, null::integer),
    ('2024-04-02'::date, 5543::bigint, null::bigint, null::integer),
    ('2024-04-03'::date, 5540::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 5536::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 5533::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 5530::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 5523::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 5520::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 5517::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 5513::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 5510::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 5507::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 5504::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 5500::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 5497::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 5494::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 5491::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 5484::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 5481::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 5478::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 5471::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 5468::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 5465::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 5462::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 5458::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 5452::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 5449::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 5408::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 5395::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 5373::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 5223::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 58 then
    raise exception '« % » : % relevés trouvés sur 58', 'Le Squirk', v_count;
  end if;

  -- L'Enclave : 103 relevés du 2024-04-03 au 2025-08-11, fermée le 2025-08-12.
  if exists (select 1 from public.companies where name = 'L''Enclave' and closed_on = '2025-08-12') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'L''Enclave', '2025-08-12';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'L''Enclave' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'L''Enclave' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-04-03' and '2025-08-11'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'L''Enclave', '2024-04-03', '2025-08-11';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('L''Enclave', '{}'::text[], v_profile, '2025-08-12', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-04-03'::date, 159::bigint, null::bigint, null::integer),
    ('2024-04-04'::date, 150::bigint, null::bigint, null::integer),
    ('2024-04-05'::date, 142::bigint, null::bigint, null::integer),
    ('2024-04-06'::date, 135::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 168::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 2335::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 2375::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 2280::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 2192::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 5356::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 5164::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 4986::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 4820::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 4708::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 4561::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 4413::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 5810::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 5649::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 6066::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 5911::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 5763::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 5710::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 5617::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 5362::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 6354::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 6271::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 6097::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 7317::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 6405::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 6768::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 6730::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 7289::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 7503::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 7522::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 7679::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 7718::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 7840::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 7797::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 7699::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 8220::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 8306::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 8262::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 8447::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 8419::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 9017::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 9177::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 9231::bigint, null::bigint, null::integer),
    ('2024-10-05'::date, 9094::bigint, null::bigint, null::integer),
    ('2024-10-18'::date, 9068::bigint, null::bigint, null::integer),
    ('2024-10-22'::date, 9131::bigint, null::bigint, null::integer),
    ('2024-10-27'::date, 9260::bigint, null::bigint, null::integer),
    ('2024-11-16'::date, 10423::bigint, null::bigint, null::integer),
    ('2024-12-09'::date, 12282::bigint, null::bigint, null::integer),
    ('2024-12-10'::date, 12288::bigint, null::bigint, null::integer),
    ('2024-12-19'::date, 13173::bigint, null::bigint, null::integer),
    ('2024-12-22'::date, 14038::bigint, null::bigint, null::integer),
    ('2025-01-03'::date, 13880::bigint, null::bigint, null::integer),
    ('2025-01-05'::date, 13795::bigint, null::bigint, null::integer),
    ('2025-01-06'::date, 13935::bigint, null::bigint, null::integer),
    ('2025-01-09'::date, 14062::bigint, null::bigint, null::integer),
    ('2025-01-11'::date, 13996::bigint, null::bigint, null::integer),
    ('2025-01-13'::date, 13949::bigint, null::bigint, null::integer),
    ('2025-01-15'::date, 13960::bigint, null::bigint, null::integer),
    ('2025-01-17'::date, 13869::bigint, null::bigint, null::integer),
    ('2025-01-26'::date, 14283::bigint, null::bigint, null::integer),
    ('2025-02-07'::date, 14465::bigint, null::bigint, null::integer),
    ('2025-02-09'::date, 14377::bigint, null::bigint, null::integer),
    ('2025-02-10'::date, 14494::bigint, null::bigint, null::integer),
    ('2025-02-12'::date, 14865::bigint, null::bigint, null::integer),
    ('2025-02-16'::date, 15483::bigint, null::bigint, null::integer),
    ('2025-02-18'::date, 15531::bigint, null::bigint, null::integer),
    ('2025-02-24'::date, 15415::bigint, null::bigint, null::integer),
    ('2025-03-07'::date, 15095::bigint, null::bigint, null::integer),
    ('2025-03-11'::date, 15037::bigint, null::bigint, null::integer),
    ('2025-03-14'::date, 14912::bigint, null::bigint, null::integer),
    ('2025-03-15'::date, 14871::bigint, null::bigint, null::integer),
    ('2025-03-20'::date, 14669::bigint, null::bigint, null::integer),
    ('2025-03-26'::date, 14446::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 14331::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 14148::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 14111::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 14002::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 13754::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 13582::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 13335::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 13210::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 15544::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 15583::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 15512::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 14573::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 14542::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 14512::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 14188::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 14131::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 14018::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 13962::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 13906::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 13879::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 13851::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 13797::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 13770::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 13716::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 13663::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 103 then
    raise exception '« % » : % relevés trouvés sur 103', 'L''Enclave', v_count;
  end if;

  -- CREATURAE : 25 relevés du 2024-04-06 au 2024-05-25, fermée le 2024-07-14.
  if exists (select 1 from public.companies where name = 'CREATURAE' and closed_on = '2024-07-14') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'CREATURAE', '2024-07-14';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'CREATURAE' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'CREATURAE' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-04-06' and '2024-05-25'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'CREATURAE', '2024-04-06', '2024-05-25';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('CREATURAE', '{}'::text[], v_profile, '2024-07-14', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-04-06'::date, 722::bigint, null::bigint, null::integer),
    ('2024-04-08'::date, 650::bigint, null::bigint, null::integer),
    ('2024-04-09'::date, 1205::bigint, null::bigint, null::integer),
    ('2024-04-10'::date, 1291::bigint, null::bigint, null::integer),
    ('2024-04-11'::date, 1235::bigint, null::bigint, null::integer),
    ('2024-04-12'::date, 1183::bigint, null::bigint, null::integer),
    ('2024-04-13'::date, 2028::bigint, null::bigint, null::integer),
    ('2024-04-14'::date, 1950::bigint, null::bigint, null::integer),
    ('2024-04-15'::date, 2396::bigint, null::bigint, null::integer),
    ('2024-04-16'::date, 2311::bigint, null::bigint, null::integer),
    ('2024-04-17'::date, 2231::bigint, null::bigint, null::integer),
    ('2024-04-18'::date, 2157::bigint, null::bigint, null::integer),
    ('2024-04-20'::date, 2022::bigint, null::bigint, null::integer),
    ('2024-04-21'::date, 1961::bigint, null::bigint, null::integer),
    ('2024-04-22'::date, 1903::bigint, null::bigint, null::integer),
    ('2024-04-24'::date, 3144::bigint, null::bigint, null::integer),
    ('2024-04-25'::date, 3059::bigint, null::bigint, null::integer),
    ('2024-04-26'::date, 2979::bigint, null::bigint, null::integer),
    ('2024-04-27'::date, 2903::bigint, null::bigint, null::integer),
    ('2024-04-28'::date, 3451::bigint, null::bigint, null::integer),
    ('2024-04-30'::date, 3287::bigint, null::bigint, null::integer),
    ('2024-05-01'::date, 3985::bigint, null::bigint, null::integer),
    ('2024-05-14'::date, 5058::bigint, null::bigint, null::integer),
    ('2024-05-18'::date, 6558::bigint, null::bigint, null::integer),
    ('2024-05-25'::date, 7381::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 25 then
    raise exception '« % » : % relevés trouvés sur 25', 'CREATURAE', v_count;
  end if;

  -- Atelier Deicola : 20 relevés du 2024-05-25 au 2024-10-02, fermée le 2024-10-05.
  if exists (select 1 from public.companies where name = 'Atelier Deicola' and closed_on = '2024-10-05') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Atelier Deicola', '2024-10-05';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Atelier Deicola' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Atelier Deicola' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2024-05-25' and '2024-10-02'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Atelier Deicola', '2024-05-25', '2024-10-02';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Atelier Deicola', '{}'::text[], v_profile, '2024-10-05', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2024-05-25'::date, 91907::bigint, null::bigint, null::integer),
    ('2024-07-14'::date, 50738::bigint, null::bigint, null::integer),
    ('2024-07-31'::date, 59079::bigint, null::bigint, null::integer),
    ('2024-08-04'::date, 60585::bigint, null::bigint, null::integer),
    ('2024-08-17'::date, 82520::bigint, null::bigint, null::integer),
    ('2024-08-20'::date, 80440::bigint, null::bigint, null::integer),
    ('2024-08-22'::date, 79110::bigint, null::bigint, null::integer),
    ('2024-09-04'::date, 75510::bigint, null::bigint, null::integer),
    ('2024-09-09'::date, 72794::bigint, null::bigint, null::integer),
    ('2024-09-12'::date, 71256::bigint, null::bigint, null::integer),
    ('2024-09-13'::date, 70758::bigint, null::bigint, null::integer),
    ('2024-09-16'::date, 69304::bigint, null::bigint, null::integer),
    ('2024-09-18'::date, 68367::bigint, null::bigint, null::integer),
    ('2024-09-19'::date, 67908::bigint, null::bigint, null::integer),
    ('2024-09-20'::date, 67456::bigint, null::bigint, null::integer),
    ('2024-09-23'::date, 66133::bigint, null::bigint, null::integer),
    ('2024-09-26'::date, 64861::bigint, null::bigint, null::integer),
    ('2024-09-28'::date, 64040::bigint, null::bigint, null::integer),
    ('2024-09-30'::date, 63240::bigint, null::bigint, null::integer),
    ('2024-10-02'::date, 62459::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 20 then
    raise exception '« % » : % relevés trouvés sur 20', 'Atelier Deicola', v_count;
  end if;

  -- Patch Works : 9 relevés du 2025-03-26 au 2025-05-17, fermée le 2025-05-28.
  if exists (select 1 from public.companies where name = 'Patch Works' and closed_on = '2025-05-28') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Patch Works', '2025-05-28';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Patch Works' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Patch Works' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2025-03-26' and '2025-05-17'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Patch Works', '2025-03-26', '2025-05-17';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Patch Works', '{}'::text[], v_profile, '2025-05-28', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2025-03-26'::date, 191250::bigint, null::bigint, null::integer),
    ('2025-03-29'::date, 408182::bigint, null::bigint, null::integer),
    ('2025-04-03'::date, 821282::bigint, null::bigint, null::integer),
    ('2025-04-04'::date, 819447::bigint, null::bigint, null::integer),
    ('2025-04-07'::date, 734290::bigint, null::bigint, null::integer),
    ('2025-04-16'::date, 574686::bigint, null::bigint, null::integer),
    ('2025-04-21'::date, 490174::bigint, null::bigint, null::integer),
    ('2025-05-13'::date, 297605::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 277765::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 9 then
    raise exception '« % » : % relevés trouvés sur 9', 'Patch Works', v_count;
  end if;

  -- Sovereign Tactical : 74 relevés du 2025-05-13 au 2026-04-27, fermée le 2026-05-05.
  if exists (select 1 from public.companies where name = 'Sovereign Tactical' and closed_on = '2026-05-05') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Sovereign Tactical', '2026-05-05';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Sovereign Tactical' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Sovereign Tactical' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2025-05-13' and '2026-04-27'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Sovereign Tactical', '2025-05-13', '2026-04-27';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Sovereign Tactical', '{}'::text[], v_profile, '2026-05-05', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2025-05-13'::date, 13757::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 12660::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 22893::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 21707::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 20621::bigint, null::bigint, null::integer),
    ('2025-07-10'::date, 54894::bigint, null::bigint, null::integer),
    ('2025-07-11'::date, 54208::bigint, null::bigint, null::integer),
    ('2025-07-12'::date, 53539::bigint, null::bigint, null::integer),
    ('2025-07-23'::date, 48149::bigint, null::bigint, null::integer),
    ('2025-07-25'::date, 48575::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 47514::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 46820::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 45902::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 46823::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 46831::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 46207::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 45775::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 45874::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 45073::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 44670::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 44275::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 43887::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 44582::bigint, 466821::bigint, 2::integer),
    ('2025-08-16'::date, 44198::bigint, 449393::bigint, 2::integer),
    ('2025-08-17'::date, 43820::bigint, 449393::bigint, 2::integer),
    ('2025-08-18'::date, 43863::bigint, 494673::bigint, 2::integer),
    ('2025-08-19'::date, 44355::bigint, 591683::bigint, 2::integer),
    ('2025-08-20'::date, 43985::bigint, 446828::bigint, 2::integer),
    ('2025-08-21'::date, 43746::bigint, 312528::bigint, 2::integer),
    ('2025-08-22'::date, 43542::bigint, 330803::bigint, 2::integer),
    ('2025-08-23'::date, 43694::bigint, 384138::bigint, 2::integer),
    ('2025-08-24'::date, 43442::bigint, 393028::bigint, 2::integer),
    ('2025-08-25'::date, 43094::bigint, 393028::bigint, 2::integer),
    ('2025-08-26'::date, 42875::bigint, 403818::bigint, 2::integer),
    ('2025-08-27'::date, 42745::bigint, 424643::bigint, 2::integer),
    ('2025-08-29'::date, 42094::bigint, 419293::bigint, 2::integer),
    ('2025-08-30'::date, 41770::bigint, 419293::bigint, 2::integer),
    ('2025-09-01'::date, 41147::bigint, 415993::bigint, 2::integer),
    ('2025-09-07'::date, 40580::bigint, 454381::bigint, 2::integer),
    ('2025-09-11'::date, 39618::bigint, 381138::bigint, 2::integer),
    ('2025-09-12'::date, 39341::bigint, 381863::bigint, 2::integer),
    ('2025-09-13'::date, 39073::bigint, 359743::bigint, 2::integer),
    ('2025-09-21'::date, 37478::bigint, 446829::bigint, 2::integer),
    ('2025-09-25'::date, 37229::bigint, 499569::bigint, 2::integer),
    ('2025-10-01'::date, 36089::bigint, 286339::bigint, 2::integer),
    ('2025-10-09'::date, 34621::bigint, 316902::bigint, 2::integer),
    ('2025-10-14'::date, 34069::bigint, 385062::bigint, 2::integer),
    ('2025-10-22'::date, 33083::bigint, 464427::bigint, 2::integer),
    ('2025-10-24'::date, 32733::bigint, 460527::bigint, 2::integer),
    ('2025-10-25'::date, 32557::bigint, 457027::bigint, 2::integer),
    ('2025-11-02'::date, 31375::bigint, 468123::bigint, 1::integer),
    ('2025-11-10'::date, 30161::bigint, 473883::bigint, 1::integer),
    ('2025-12-03'::date, 27313::bigint, 526733::bigint, 1::integer),
    ('2025-12-10'::date, 26769::bigint, 591778::bigint, 1::integer),
    ('2025-12-18'::date, 26108::bigint, 647248::bigint, 1::integer),
    ('2025-12-19'::date, 26064::bigint, 662638::bigint, 1::integer),
    ('2026-01-31'::date, 22416::bigint, 747368::bigint, 1::integer),
    ('2026-02-19'::date, 21297::bigint, 834193::bigint, 1::integer),
    ('2026-02-22'::date, 21088::bigint, 834193::bigint, 1::integer),
    ('2026-02-26'::date, 20906::bigint, 747368::bigint, 1::integer),
    ('2026-03-01'::date, 20705::bigint, 1059473::bigint, 1::integer),
    ('2026-03-13'::date, 19960::bigint, 1067453::bigint, 1::integer),
    ('2026-03-14'::date, 19904::bigint, 1067453::bigint, 1::integer),
    ('2026-03-19'::date, 19639::bigint, 1079068::bigint, 1::integer),
    ('2026-03-24'::date, 19387::bigint, 1092863::bigint, 1::integer),
    ('2026-03-28'::date, 19159::bigint, 1092863::bigint, 1::integer),
    ('2026-03-30'::date, 19047::bigint, 1092863::bigint, 1::integer),
    ('2026-03-31'::date, 18992::bigint, 1092863::bigint, 1::integer),
    ('2026-04-02'::date, 18882::bigint, 1092863::bigint, 1::integer),
    ('2026-04-06'::date, 18665::bigint, 1092863::bigint, 1::integer),
    ('2026-04-09'::date, 18506::bigint, 1092863::bigint, 1::integer),
    ('2026-04-17'::date, 18095::bigint, 1092863::bigint, 1::integer),
    ('2026-04-20'::date, 17945::bigint, 1092863::bigint, 1::integer),
    ('2026-04-27'::date, 17606::bigint, 1092863::bigint, 1::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 74 then
    raise exception '« % » : % relevés trouvés sur 74', 'Sovereign Tactical', v_count;
  end if;

  -- Saviors Design : 5 relevés du 2025-05-13 au 2025-06-01, fermée le 2025-07-10.
  if exists (select 1 from public.companies where name = 'Saviors Design' and closed_on = '2025-07-10') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Saviors Design', '2025-07-10';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Saviors Design' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Saviors Design' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2025-05-13' and '2025-06-01'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Saviors Design', '2025-05-13', '2025-06-01';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Saviors Design', '{}'::text[], v_profile, '2025-07-10', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2025-05-13'::date, 122106::bigint, null::bigint, null::integer),
    ('2025-05-17'::date, 100870::bigint, null::bigint, null::integer),
    ('2025-05-28'::date, 91500::bigint, null::bigint, null::integer),
    ('2025-05-30'::date, 86417::bigint, null::bigint, null::integer),
    ('2025-06-01'::date, 81869::bigint, null::bigint, null::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 5 then
    raise exception '« % » : % relevés trouvés sur 5', 'Saviors Design', v_count;
  end if;

  -- Manticore : 36 relevés du 2025-07-25 au 2025-10-01, fermée le 2025-10-09.
  if exists (select 1 from public.companies where name = 'Manticore' and closed_on = '2025-10-09') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Manticore', '2025-10-09';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Manticore' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Manticore' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2025-07-25' and '2025-10-01'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Manticore', '2025-07-25', '2025-10-01';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Manticore', '{}'::text[], v_profile, '2025-10-09', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2025-07-25'::date, 0::bigint, null::bigint, null::integer),
    ('2025-07-29'::date, 0::bigint, null::bigint, null::integer),
    ('2025-07-31'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-02'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-03'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-04'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-06'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-07'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-09'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-11'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-12'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-13'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-14'::date, 0::bigint, null::bigint, null::integer),
    ('2025-08-15'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-16'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-17'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-18'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-19'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-20'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-21'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-22'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-23'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-24'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-25'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-26'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-27'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-29'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-08-30'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-09-01'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-09-07'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-09-11'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-09-12'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-09-13'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-09-21'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-09-25'::date, 0::bigint, 2743::bigint, 0::integer),
    ('2025-10-01'::date, 0::bigint, 2743::bigint, 0::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 36 then
    raise exception '« % » : % relevés trouvés sur 36', 'Manticore', v_count;
  end if;

  -- Vindicta Templum : 2 relevés du 2026-03-30 au 2026-03-31, fermée le 2026-04-02.
  if exists (select 1 from public.companies where name = 'Vindicta Templum' and closed_on = '2026-04-02') then
    raise exception 'déjà appliqué : « % » fermée le % existe', 'Vindicta Templum', '2026-04-02';
  end if;
  v_profile := null;
  select c.profile_id into v_profile from public.companies c
  where c.name = 'Vindicta Templum' order by c.closed_on desc nulls first, c.id desc limit 1;
  if v_profile is null then
    insert into public.company_profiles (consortium_id)
    values ((select k.id from public.consortiums k
             where 'Vindicta Templum' like k.name || ' %' order by length(k.name) desc limit 1))
    returning id into v_profile;
  elsif exists (
    select 1 from public.snapshot_rows sr
    join public.snapshots s on s.id = sr.snapshot_id
    join public.companies c on c.id = sr.company_id
    where c.profile_id = v_profile and s.taken_on between '2026-03-30' and '2026-03-31'
  ) then
    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', 'Vindicta Templum', '2026-03-30', '2026-03-31';
  end if;
  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)
  values ('Vindicta Templum', '{}'::text[], v_profile, '2026-04-02', null)
  returning id into v_company;
  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select s.id, v_company, null, v.chiffre, v.capital, v.employees
  from (values
    ('2026-03-30'::date, 0::bigint, 3647815::bigint, 0::integer),
    ('2026-03-31'::date, 0::bigint, 3647815::bigint, 0::integer)
  ) as v(taken_on, chiffre, capital, employees)
  join public.snapshots s on s.taken_on = v.taken_on;
  get diagnostics v_count = row_count;
  if v_count <> 2 then
    raise exception '« % » : % relevés trouvés sur 2', 'Vindicta Templum', v_count;
  end if;

  -- Anciens noms retrouvés dans les colonnes renommées.
  update public.companies set aliases = array_append(aliases, 'InMeaBulla')
  where name = 'Metropolis' and closed_on is null and not ('InMeaBulla' = any(aliases));
  update public.companies set aliases = array_append(aliases, 'Hypercore')
  where name = 'NeuroCore Systems' and closed_on is null and not ('Hypercore' = any(aliases));
  update public.companies set aliases = array_append(aliases, 'Kessler Distribution™')
  where name = 'NeuroCore Systems' and closed_on is null and not ('Kessler Distribution™' = any(aliases));
  update public.companies set aliases = array_append(aliases, 'Au Coup d''Poêle')
  where name = 'Apothéca' and closed_on is null and not ('Au Coup d''Poêle' = any(aliases));
  update public.companies set aliases = array_append(aliases, 'Sovereign Nidavellir')
  where name = 'Sovereign Muse' and closed_on is null and not ('Sovereign Nidavellir' = any(aliases));
  update public.companies set aliases = array_append(aliases, 'Horizon et Style')
  where name = 'Place Horizon' and closed_on is null and not ('Horizon et Style' = any(aliases));
  update public.companies set aliases = array_append(aliases, 'L''Antre Côte')
  where name = 'La Trame Fukyû' and closed_on is null and not ('L''Antre Côte' = any(aliases));
  update public.companies set aliases = array_append(aliases, 'Edge Logistics')
  where name = 'Kessler Industries™' and closed_on is null and not ('Edge Logistics' = any(aliases));
  update public.companies set aliases = array_append(aliases, 'MilitariX')
  where name = 'L''Impact' and closed_on is null and not ('MilitariX' = any(aliases));
end;
$$;
