--
-- PostgreSQL database cluster dump
--

\restrict nnCgTw9fABKHF6H8omMZCc8hPjLeNsM0VY6qqSgxJeCrk7Iu0katiJN11Vxhbdh

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:hGQ/9Q7+OxeF+2ZJ4O5kRg==$tbLE8BsEZxHDCwk0wpJRLs++HGLknmDXmOz7KLEVZ50=:5EXfEWxgpvkyKewefYNPTXq5DQBOQTFf6IvoY/9jrh4=';
CREATE ROLE replicator;
ALTER ROLE replicator WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:kyUWgMHx5n8MoDKyBAr2hg==$b4XQLDjFkFijnpE6MI2eoZtFa70fDEApdQgMah5xXLc=:GCImD9qO+TOZA81azI4ZmcQqLUDAoHBP4pigkved/g8=';

--
-- User Configurations
--








\unrestrict nnCgTw9fABKHF6H8omMZCc8hPjLeNsM0VY6qqSgxJeCrk7Iu0katiJN11Vxhbdh

--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

--
-- PostgreSQL database dump
--

\restrict veQfUt7T7cMYdpwIkgWCWtoBrEHcESQ21epFISPrqyGSB23eaaaok2nqj4DZ2tV

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- PostgreSQL database dump complete
--

\unrestrict veQfUt7T7cMYdpwIkgWCWtoBrEHcESQ21epFISPrqyGSB23eaaaok2nqj4DZ2tV

--
-- Database "news_aggregator" dump
--

--
-- PostgreSQL database dump
--

\restrict tgMhtse9tXAVIVXX37lll0w7UPpd3e12csQy9EzgjYMPWZplDC04DZePoinT5vn

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: news_aggregator; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE news_aggregator WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE news_aggregator OWNER TO postgres;

\unrestrict tgMhtse9tXAVIVXX37lll0w7UPpd3e12csQy9EzgjYMPWZplDC04DZePoinT5vn
\connect news_aggregator
\restrict tgMhtse9tXAVIVXX37lll0w7UPpd3e12csQy9EzgjYMPWZplDC04DZePoinT5vn

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- PostgreSQL database dump complete
--

\unrestrict tgMhtse9tXAVIVXX37lll0w7UPpd3e12csQy9EzgjYMPWZplDC04DZePoinT5vn

--
-- Database "postgres" dump
--

\connect postgres

--
-- PostgreSQL database dump
--

\restrict 9YdcIPByhfIT4EaAesmTZl92B1mXmHUd27TO90D7L2ko8aznuzeCvm6nZKujkCd

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- PostgreSQL database dump complete
--

\unrestrict 9YdcIPByhfIT4EaAesmTZl92B1mXmHUd27TO90D7L2ko8aznuzeCvm6nZKujkCd

--
-- PostgreSQL database cluster dump complete
--

