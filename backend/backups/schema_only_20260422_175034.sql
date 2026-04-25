--
-- PostgreSQL database dump
--

\restrict dyMxxrv1AmdVXCwMk7qnWlfy3cM5FvbdbxjfN8UurJWsBStvEaglS6t9PfoLEbS

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg12+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg12+1)

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
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    performed_by character varying(255) NOT NULL,
    details json,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: catalog_ball_valve; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_ball_valve (
    row_id uuid NOT NULL,
    client_id character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sr_no double precision,
    variant_type text,
    construction text,
    valve_size text,
    bore_type text,
    end_connection text,
    pressure text,
    body text,
    ball text,
    stem text,
    seat text,
    fasteners text,
    price_inr double precision,
    source_file text
);


--
-- Name: catalog_brackets_coupler; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_brackets_coupler (
    row_id uuid NOT NULL,
    client_id character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bracket_operator text,
    construct text,
    size_text text,
    price_inr double precision
);


--
-- Name: catalog_butterfly_valve; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_butterfly_valve (
    row_id uuid NOT NULL,
    client_id character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sr_no double precision,
    variant_type text,
    construction text,
    valve_size text,
    bore_type text,
    end_connection text,
    pressure text,
    body text,
    ball_disc text,
    stem text,
    seat text,
    fasteners text,
    price_inr double precision,
    source_file text
);


--
-- Name: catalog_limit_switch_box; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_limit_switch_box (
    row_id uuid NOT NULL,
    client_id character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sr_no double precision,
    variant_type text,
    price_inr double precision
);


--
-- Name: catalog_operator; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_operator (
    row_id uuid NOT NULL,
    client_id character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    operator_for text,
    construct text,
    size_text text,
    model_name text,
    price_inr double precision
);


--
-- Name: catalog_positioner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_positioner (
    row_id uuid NOT NULL,
    client_id character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sr_no double precision,
    variant_type text,
    price_inr double precision
);


--
-- Name: catalog_sov; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_sov (
    row_id uuid NOT NULL,
    client_id character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sr_no double precision,
    variant_type text,
    price_inr double precision
);


--
-- Name: client_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_records (
    id uuid NOT NULL,
    company_name character varying NOT NULL,
    contact_name character varying,
    email character varying,
    phone character varying,
    city character varying,
    country character varying NOT NULL,
    erp_code character varying,
    is_erp_synced boolean NOT NULL,
    source character varying NOT NULL,
    enquiry_count integer NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_sync_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_sync_state (
    id integer NOT NULL,
    baseline_at timestamp with time zone
);


--
-- Name: email_sync_state_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_sync_state_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_sync_state_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_sync_state_id_seq OWNED BY public.email_sync_state.id;


--
-- Name: enquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enquiries (
    id uuid NOT NULL,
    client_config character varying(100) NOT NULL,
    raw_input text NOT NULL,
    input_type character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    client_id uuid,
    erp_export_path character varying,
    parsed_data json,
    matched_products json,
    confidence_score double precision,
    ai_reasoning text,
    missing_fields json,
    assigned_to character varying(255),
    flow_type character varying(100),
    error_message text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    processing_started_at timestamp with time zone,
    processing_completed_at timestamp with time zone
);


--
-- Name: processed_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_emails (
    id uuid NOT NULL,
    message_id character varying NOT NULL,
    sender_email character varying NOT NULL,
    sender_name character varying,
    subject character varying,
    received_at timestamp with time zone NOT NULL,
    enquiry_id uuid,
    was_processed boolean NOT NULL,
    filter_reason character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotations (
    id uuid NOT NULL,
    enquiry_id uuid NOT NULL,
    quote_number character varying(50) NOT NULL,
    client_name character varying(255) NOT NULL,
    client_company character varying(255),
    client_email character varying(255),
    client_phone character varying(50),
    line_items json NOT NULL,
    subtotal double precision NOT NULL,
    gst_rate double precision NOT NULL,
    gst_amount double precision NOT NULL,
    pf_rate double precision NOT NULL,
    pf_amount double precision NOT NULL,
    freight_note character varying(255) NOT NULL,
    total_amount double precision NOT NULL,
    validity_days integer NOT NULL,
    status character varying(50) NOT NULL,
    pdf_path character varying(500),
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    device_info character varying
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    permission character varying NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying NOT NULL,
    full_name character varying NOT NULL,
    hashed_password character varying NOT NULL,
    tier character varying NOT NULL,
    job_title character varying,
    is_active boolean NOT NULL,
    is_first_login boolean NOT NULL,
    created_by uuid,
    last_login_at timestamp with time zone,
    last_login_ip character varying,
    reset_token character varying,
    reset_token_expires timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_sync_state id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sync_state ALTER COLUMN id SET DEFAULT nextval('public.email_sync_state_id_seq'::regclass);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: catalog_ball_valve catalog_ball_valve_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_ball_valve
    ADD CONSTRAINT catalog_ball_valve_pkey PRIMARY KEY (row_id);


--
-- Name: catalog_brackets_coupler catalog_brackets_coupler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_brackets_coupler
    ADD CONSTRAINT catalog_brackets_coupler_pkey PRIMARY KEY (row_id);


--
-- Name: catalog_butterfly_valve catalog_butterfly_valve_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_butterfly_valve
    ADD CONSTRAINT catalog_butterfly_valve_pkey PRIMARY KEY (row_id);


--
-- Name: catalog_limit_switch_box catalog_limit_switch_box_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_limit_switch_box
    ADD CONSTRAINT catalog_limit_switch_box_pkey PRIMARY KEY (row_id);


--
-- Name: catalog_operator catalog_operator_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_operator
    ADD CONSTRAINT catalog_operator_pkey PRIMARY KEY (row_id);


--
-- Name: catalog_positioner catalog_positioner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_positioner
    ADD CONSTRAINT catalog_positioner_pkey PRIMARY KEY (row_id);


--
-- Name: catalog_sov catalog_sov_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_sov
    ADD CONSTRAINT catalog_sov_pkey PRIMARY KEY (row_id);


--
-- Name: client_records client_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_records
    ADD CONSTRAINT client_records_pkey PRIMARY KEY (id);


--
-- Name: email_sync_state email_sync_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sync_state
    ADD CONSTRAINT email_sync_state_pkey PRIMARY KEY (id);


--
-- Name: enquiries enquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiries
    ADD CONSTRAINT enquiries_pkey PRIMARY KEY (id);


--
-- Name: processed_emails processed_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_emails
    ADD CONSTRAINT processed_emails_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quote_number_key UNIQUE (quote_number);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: user_permissions uq_user_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT uq_user_permission UNIQUE (user_id, permission);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_catalog_ball_valve_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_catalog_ball_valve_client_id ON public.catalog_ball_valve USING btree (client_id);


--
-- Name: ix_catalog_brackets_coupler_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_catalog_brackets_coupler_client_id ON public.catalog_brackets_coupler USING btree (client_id);


--
-- Name: ix_catalog_butterfly_valve_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_catalog_butterfly_valve_client_id ON public.catalog_butterfly_valve USING btree (client_id);


--
-- Name: ix_catalog_limit_switch_box_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_catalog_limit_switch_box_client_id ON public.catalog_limit_switch_box USING btree (client_id);


--
-- Name: ix_catalog_operator_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_catalog_operator_client_id ON public.catalog_operator USING btree (client_id);


--
-- Name: ix_catalog_positioner_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_catalog_positioner_client_id ON public.catalog_positioner USING btree (client_id);


--
-- Name: ix_catalog_sov_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_catalog_sov_client_id ON public.catalog_sov USING btree (client_id);


--
-- Name: ix_client_records_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_client_records_email ON public.client_records USING btree (email);


--
-- Name: ix_client_records_erp_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_client_records_erp_code ON public.client_records USING btree (erp_code);


--
-- Name: ix_processed_emails_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_processed_emails_message_id ON public.processed_emails USING btree (message_id);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_reset_token ON public.users USING btree (reset_token);


--
-- Name: enquiries enquiries_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiries
    ADD CONSTRAINT enquiries_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client_records(id);


--
-- Name: processed_emails processed_emails_enquiry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_emails
    ADD CONSTRAINT processed_emails_enquiry_id_fkey FOREIGN KEY (enquiry_id) REFERENCES public.enquiries(id);


--
-- Name: quotations quotations_enquiry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_enquiry_id_fkey FOREIGN KEY (enquiry_id) REFERENCES public.enquiries(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict dyMxxrv1AmdVXCwMk7qnWlfy3cM5FvbdbxjfN8UurJWsBStvEaglS6t9PfoLEbS

