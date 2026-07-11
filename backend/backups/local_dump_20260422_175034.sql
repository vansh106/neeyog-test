--
-- PostgreSQL database dump
--

\restrict 2H0qsggSdTFQIitqrjonncIwU8wyElfGbaS8YMpdHd0vy79AxTpvu9nzszPuCHW

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
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
b7c8d9e0f1a2
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, entity_type, entity_id, action, performed_by, details, created_at) FROM stdin;
35da3509-e22c-4a3e-8feb-df5ff2ad0522	enquiry	b4f4ae6a-ea10-41e4-ab4e-b3a131597def	ai_processed	system	{"flow_type": "incomplete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 05:30:38.937193+00
7be0d99a-6900-4c72-8fec-1683f1545d51	enquiry	b4f4ae6a-ea10-41e4-ab4e-b3a131597def	hitl_decision_approve_send	marketing_user	{"decision": "approve_send", "human_prompt": null, "cycle": 1}	2026-04-17 05:31:50.697679+00
df753b89-b8b6-4ed8-8905-9c0eaa6ae216	enquiry	37a56b29-4da2-4fa5-a382-5a7c599aade7	ai_processed	system	{"flow_type": "incomplete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 05:32:49.027807+00
e5f02cd8-77d6-48ae-ada7-39f93c047e73	enquiry	5b78391f-b936-4702-a649-a3b4c212c24b	ai_processed	system	{"flow_type": "incomplete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 05:57:57.7483+00
5dda8de8-23b6-4a04-b0e8-3166d8110052	enquiry	70f4ae07-405c-4274-b7c4-750665c98524	ai_processed	system	{"flow_type": "incomplete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 06:44:57.883287+00
083c3805-a05f-4bf7-b41f-86dd4508f1e7	enquiry	70f4ae07-405c-4274-b7c4-750665c98524	hitl_decision_approve_send	marketing_user	{"decision": "approve_send", "human_prompt": null, "cycle": 1}	2026-04-17 06:45:38.164725+00
bf08da08-7930-4e85-9535-92e2b16ff73b	enquiry	2d0eed5d-f592-4cdb-8764-c95d1aa45103	ai_processed	system	{"flow_type": "incomplete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 06:50:35.263592+00
13910a7e-30c7-44ad-a446-8abee24d769b	enquiry	2d0eed5d-f592-4cdb-8764-c95d1aa45103	hitl_decision_approve_send	marketing_user	{"decision": "approve_send", "human_prompt": null, "cycle": 1}	2026-04-17 06:51:29.322463+00
e257ec24-4d54-4367-afd7-6c878f7bde09	enquiry	4ff6598e-8ab5-441a-8142-b40445ad41cf	ai_processed	system	{"flow_type": "incomplete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 07:39:47.457209+00
c1f5970d-e5ba-4ce5-a030-3ca10e7de0d7	enquiry	4ff6598e-8ab5-441a-8142-b40445ad41cf	hitl_decision_approve_send	marketing_user	{"decision": "approve_send", "human_prompt": null, "cycle": 1}	2026-04-17 07:41:51.098504+00
6db33c8b-61de-48fe-9ea8-87e8c8e6f12e	enquiry	b4a465b0-17cd-463a-ac41-e6ad99a082e0	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 07:44:31.970239+00
17528943-1e3b-49cd-b777-e5206841f6bd	enquiry	b4a465b0-17cd-463a-ac41-e6ad99a082e0	hitl_decision_edit_email	marketing_user	{"decision": "edit_email", "human_prompt": null, "cycle": 2}	2026-04-17 07:46:18.442723+00
1f7deee1-ae34-48c0-8101-bcbb8b025c5d	enquiry	4c04bc91-65c1-4ac2-8150-c73c0e9db4d3	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false}	2026-04-17 07:53:59.55073+00
3546c0d5-1b52-4ad5-a728-3ec719ce5a83	enquiry	94d3f247-0776-40b7-a537-04995423de0a	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 07:56:47.293404+00
b8244418-73da-48fb-8f92-e767c2c53613	enquiry	5c21722f-d8fa-4e5f-ab1c-719b5a6d79b1	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 08:00:15.52705+00
abde831c-b8e0-49fa-ad42-367b7d79ddf2	enquiry	4e2e81df-4cc4-46d8-a2cb-04259f8bd816	ai_processed	system	{"flow_type": "incomplete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 08:01:35.921089+00
565f6611-80ba-4128-8089-8c440824a81b	enquiry	4e2e81df-4cc4-46d8-a2cb-04259f8bd816	hitl_decision_approve_send	marketing_user	{"decision": "approve_send", "human_prompt": null, "cycle": 1}	2026-04-17 08:02:20.603565+00
0e28778a-757d-4d80-bbdd-610735f371ec	enquiry	dca86ecd-6c02-40b3-99bf-3b98c8e3ed63	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 08:04:45.842519+00
311c4966-2b89-4e18-9324-3e51516fabbb	enquiry	dca86ecd-6c02-40b3-99bf-3b98c8e3ed63	hitl_decision_edit_email	marketing_user	{"decision": "edit_email", "human_prompt": null, "cycle": 2}	2026-04-17 08:05:52.117254+00
5cff490a-5faf-40ea-a359-e8411f0d3c4b	enquiry	dca86ecd-6c02-40b3-99bf-3b98c8e3ed63	hitl_decision_edit_email	marketing_user	{"decision": "edit_email", "human_prompt": null, "cycle": 3}	2026-04-17 08:06:56.304172+00
59a8bdd3-f0d7-4c6c-88a7-bfbbcf1cae99	enquiry	dca86ecd-6c02-40b3-99bf-3b98c8e3ed63	hitl_decision_edit_email	marketing_user	{"decision": "edit_email", "human_prompt": null, "cycle": 4}	2026-04-17 08:10:28.222648+00
84fd30a4-e2d3-4524-984b-415afc5af633	enquiry	dca86ecd-6c02-40b3-99bf-3b98c8e3ed63	hitl_decision_edit_email	marketing_user	{"decision": "edit_email", "human_prompt": null, "cycle": 5}	2026-04-17 08:10:30.213425+00
09bbe6d4-ee18-4f34-a421-f8607f038cda	enquiry	dca86ecd-6c02-40b3-99bf-3b98c8e3ed63	hitl_decision_edit_email	marketing_user	{"decision": "edit_email", "human_prompt": null, "cycle": 6}	2026-04-17 08:10:31.928902+00
b54bda30-03c2-4f33-8d35-f32847f64784	enquiry	a1fb8b71-7a52-47d4-9c84-ef95ca70c9e7	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 08:10:53.623438+00
71de928d-325a-47f2-a541-29ab297054d5	enquiry	d958e073-5844-4d03-9e8b-1ee1ae07e03a	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 08:20:38.401515+00
641fb232-6581-426a-a265-e6fd5f518032	enquiry	84d9945a-b860-4096-b5e4-986182c2d747	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false}	2026-04-17 08:25:14.487059+00
ab39b44b-f797-41b9-a99c-3318a77f7c3a	enquiry	cb1867c9-d5de-4240-b768-eb35c7f339f2	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 08:29:49.451334+00
97cfa09e-adf2-43f0-84e3-00639e82f505	enquiry	2889b0c6-2733-4971-8033-b9040332da28	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "source": "email_sync"}	2026-04-17 09:14:53.953946+00
da7b23ad-0b4e-4a5c-9758-9839cb15f539	enquiry	ca215ae8-6d17-44cd-b935-b8a220e85c79	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "source": "email_sync"}	2026-04-17 09:44:52.477456+00
8b62069c-8392-4720-98fe-222c55ca7fc5	enquiry	8826bcaa-59b9-4561-90f9-8ae29c2e1599	ai_processed	system	{"flow_type": "complete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 10:03:04.457957+00
ca4b142d-959d-4783-882e-3e271c46f617	enquiry	1f9bcbbd-51cb-4ca7-8dd4-42157ac3544f	ai_processed	system	{"flow_type": "incomplete", "current_step": "client_verification", "has_quotation": false, "awaiting_human": true}	2026-04-17 10:13:14.9978+00
\.


--
-- Data for Name: catalog_ball_valve; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.catalog_ball_valve (row_id, client_id, created_at, updated_at, sr_no, variant_type, construction, valve_size, bore_type, end_connection, pressure, body, ball, stem, seat, fasteners, price_inr, source_file) FROM stdin;
6a41a648-1e88-439e-b919-d9029b67c72d	parth_valves	2026-04-21 04:07:59.280868+00	2026-04-21 08:56:22.459305+00	116	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	2.02	File 49
a270d4ad-fb51-4eff-bc50-d849a3b21d56	parth_valves	2026-04-21 04:07:59.280787+00	2026-04-21 04:07:59.28079+00	1	Ball Valve	1-Piece, 2 Way	40×40 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
d57eaf64-7234-4167-bd7b-89458a92a9a9	parth_valves	2026-04-21 04:07:59.280791+00	2026-04-21 04:07:59.280791+00	2	Ball Valve	1-Piece, 2 Way	40×40 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
42cab0bb-96ce-460a-b2b8-59fce9b00061	parth_valves	2026-04-21 04:07:59.280792+00	2026-04-21 04:07:59.280792+00	3	Ball Valve	1-Piece, 2 Way	40×25 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
97d1db8d-2a1f-48b8-b9e5-d30621efb4ad	parth_valves	2026-04-21 04:07:59.280793+00	2026-04-21 04:07:59.280793+00	4	Ball Valve	1-Piece, 2 Way	40×25 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
1bbcf9ff-b3f1-43ad-b3b8-15ff1b78c959	parth_valves	2026-04-21 04:07:59.280793+00	2026-04-21 04:07:59.280794+00	5	Ball Valve	1-Piece, 2 Way	50×50 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
e5a8a342-acf1-4773-ae3b-645d68064bb7	parth_valves	2026-04-21 04:07:59.280794+00	2026-04-21 04:07:59.280794+00	6	Ball Valve	1-Piece, 2 Way	50×50 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
ed41ca6c-8af1-4605-a4d7-903191b7c1af	parth_valves	2026-04-21 04:07:59.280795+00	2026-04-21 04:07:59.280795+00	7	Ball Valve	1-Piece, 2 Way	50×40 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
0de1bfab-27e3-4fb1-898f-c99af29a628a	parth_valves	2026-04-21 04:07:59.280795+00	2026-04-21 04:07:59.280796+00	8	Ball Valve	1-Piece, 2 Way	50×40 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
4e3abb89-291c-4c6f-a531-52e896eaa41b	parth_valves	2026-04-21 04:07:59.280796+00	2026-04-21 04:07:59.280796+00	9	Ball Valve	1-Piece, 2 Way	65×65 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
439edbe4-c1b9-4366-a4c5-96fae951c49e	parth_valves	2026-04-21 04:07:59.280824+00	2026-04-21 04:07:59.280825+00	51	Ball Valve	3-Piece, 2 Way	3"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
a3073fc7-48eb-4464-ad64-59d4c445a21b	parth_valves	2026-04-21 04:07:59.280797+00	2026-04-21 04:07:59.280797+00	10	Ball Valve	1-Piece, 2 Way	65×65 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
0fe6ba00-938e-458e-abd1-8ddf37720b7f	parth_valves	2026-04-21 04:07:59.280797+00	2026-04-21 04:07:59.280798+00	11	Ball Valve	1-Piece, 2 Way	65×50 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
b9dfef32-2fa8-4f17-9514-753f2413b949	parth_valves	2026-04-21 04:07:59.280798+00	2026-04-21 04:07:59.280798+00	12	Ball Valve	1-Piece, 2 Way	65×50 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
9e5be116-e6ce-4553-95f1-d1bab16015e5	parth_valves	2026-04-21 04:07:59.280799+00	2026-04-21 04:07:59.280799+00	13	Ball Valve	1-Piece, 2 Way	80×80 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
9f1a27a6-26f3-4083-93b3-96a77fe71172	parth_valves	2026-04-21 04:07:59.280799+00	2026-04-21 04:07:59.2808+00	14	Ball Valve	1-Piece, 2 Way	80×80 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
0d6a46b3-16e4-40ea-b9a8-aada7d8aa531	parth_valves	2026-04-21 04:07:59.2808+00	2026-04-21 04:07:59.2808+00	15	Ball Valve	1-Piece, 2 Way	80×65 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
ddbf58a0-bd80-4c74-9023-191918abae11	parth_valves	2026-04-21 04:07:59.280801+00	2026-04-21 04:07:59.280801+00	16	Ball Valve	1-Piece, 2 Way	80×65 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
b23b5f6d-132f-46d5-b4da-04daacb6d673	parth_valves	2026-04-21 04:07:59.280801+00	2026-04-21 04:07:59.280802+00	17	Ball Valve	1-Piece, 2 Way	80×50 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
06b5fe06-f99b-4c1e-98da-d6c1ffad2729	parth_valves	2026-04-21 04:07:59.280802+00	2026-04-21 04:07:59.280802+00	18	Ball Valve	1-Piece, 2 Way	80×50 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
db81762e-340e-42dc-8aca-a29f9978a2fa	parth_valves	2026-04-21 04:07:59.280803+00	2026-04-21 04:07:59.280803+00	19	Ball Valve	1-Piece, 2 Way	100×100 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
5a8ba3ee-7c63-4aef-989c-d3ded967f550	parth_valves	2026-04-21 04:07:59.280803+00	2026-04-21 04:07:59.280804+00	20	Ball Valve	1-Piece, 2 Way	100×100 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
a1949517-4f42-4328-9456-544396c13ce7	parth_valves	2026-04-21 04:07:59.280804+00	2026-04-21 04:07:59.280805+00	21	Ball Valve	1-Piece, 2 Way	100×80 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
a76ee165-f5cf-4640-9ef2-3774411268ff	parth_valves	2026-04-21 04:07:59.280805+00	2026-04-21 04:07:59.280805+00	22	Ball Valve	1-Piece, 2 Way	100×80 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
abf6bb10-0384-4f7b-abd8-b8b83980bff0	parth_valves	2026-04-21 04:07:59.280806+00	2026-04-21 04:07:59.280806+00	23	Ball Valve	1-Piece, 2 Way	150×150 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
0a361d65-ae33-4df3-bfb0-817d255f4409	parth_valves	2026-04-21 04:07:59.280806+00	2026-04-21 04:07:59.280807+00	24	Ball Valve	1-Piece, 2 Way	150×150 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
83185518-093a-4e41-b8a6-836462c3d851	parth_valves	2026-04-21 04:07:59.280807+00	2026-04-21 04:07:59.280807+00	25	Ball Valve	1-Piece, 2 Way	150×100 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 6
7873d710-f1a3-448e-966b-d3858d69377b	parth_valves	2026-04-21 04:07:59.280808+00	2026-04-21 04:07:59.280808+00	26	Ball Valve	1-Piece, 2 Way	150×100 mm	Reduced Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 6
3c3afcfb-4803-44a2-aecf-0a0bbd91f307	parth_valves	2026-04-21 04:07:59.280808+00	2026-04-21 04:07:59.280809+00	27	Ball Valve	3-Piece, 2 Way	1/2"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
27c9ea2c-f166-4eee-a50d-7c3d505536db	parth_valves	2026-04-21 04:07:59.280809+00	2026-04-21 04:07:59.280809+00	28	Ball Valve	3-Piece, 2 Way	3/4"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
956905de-5862-4316-ab65-f0117d23bf67	parth_valves	2026-04-21 04:07:59.28081+00	2026-04-21 04:07:59.28081+00	29	Ball Valve	3-Piece, 2 Way	1"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
5042b02b-722f-4d3a-8b79-4f01d775ec58	parth_valves	2026-04-21 04:07:59.28081+00	2026-04-21 04:07:59.280811+00	30	Ball Valve	3-Piece, 2 Way	1 1/4"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
bbd56b41-da65-45f2-8368-b33fc8dcfc53	parth_valves	2026-04-21 04:07:59.280811+00	2026-04-21 04:07:59.280811+00	31	Ball Valve	3-Piece, 2 Way	1 1/2"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
d1a05a24-9efc-49db-a242-cc53ea8ddb52	parth_valves	2026-04-21 04:07:59.280812+00	2026-04-21 04:07:59.280812+00	32	Ball Valve	3-Piece, 2 Way	2"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
5478f8d2-8729-4af6-8c34-9c51dc42d4f0	parth_valves	2026-04-21 04:07:59.280812+00	2026-04-21 04:07:59.280813+00	33	Ball Valve	3-Piece, 2 Way	2 1/2"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
454cd115-871b-47eb-b9bc-9c1310c619ba	parth_valves	2026-04-21 04:07:59.280813+00	2026-04-21 04:07:59.280813+00	34	Ball Valve	3-Piece, 2 Way	3"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
35d38871-88ac-426a-a459-32da4302460b	parth_valves	2026-04-21 04:07:59.280814+00	2026-04-21 04:07:59.280814+00	35	Ball Valve	3-Piece, 2 Way	4"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
6e04e0c6-f19b-45bd-99ef-7a344becff6a	parth_valves	2026-04-21 04:07:59.280814+00	2026-04-21 04:07:59.280815+00	36	Ball Valve	3-Piece, 2 Way	6"	Full Bore	Flanged (ASME B16.5 #150)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
1f6ee4d0-aca5-4909-9847-69604417c16c	parth_valves	2026-04-21 04:07:59.280815+00	2026-04-21 04:07:59.280815+00	37	Ball Valve	3-Piece, 2 Way	1/2"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
d624e0aa-ef44-4af7-adf9-ff19acc167f7	parth_valves	2026-04-21 04:07:59.280816+00	2026-04-21 04:07:59.280816+00	38	Ball Valve	3-Piece, 2 Way	1/2"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
2c1cf248-e9c9-476f-bfc3-0771cf55f819	parth_valves	2026-04-21 04:07:59.280816+00	2026-04-21 04:07:59.280817+00	39	Ball Valve	3-Piece, 2 Way	3/4"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
6e53b6c9-603b-4ac7-a3cd-ddeac1865597	parth_valves	2026-04-21 04:07:59.280817+00	2026-04-21 04:07:59.280817+00	40	Ball Valve	3-Piece, 2 Way	3/4"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
c370bcd4-e454-4e04-af69-dba268dc4ce1	parth_valves	2026-04-21 04:07:59.280818+00	2026-04-21 04:07:59.280818+00	41	Ball Valve	3-Piece, 2 Way	1"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
a3abb1a8-ff13-44a9-912e-2e526c844641	parth_valves	2026-04-21 04:07:59.280818+00	2026-04-21 04:07:59.280819+00	42	Ball Valve	3-Piece, 2 Way	1"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
7b8cde3e-9356-4dbb-953b-26c3bf5a959f	parth_valves	2026-04-21 04:07:59.280819+00	2026-04-21 04:07:59.280819+00	43	Ball Valve	3-Piece, 2 Way	1 1/4"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
c5171d18-2174-4773-9be3-2fc665ea9405	parth_valves	2026-04-21 04:07:59.28082+00	2026-04-21 04:07:59.28082+00	44	Ball Valve	3-Piece, 2 Way	1 1/4"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
62d66967-28ab-4c9e-8862-b9a03acbfa00	parth_valves	2026-04-21 04:07:59.28082+00	2026-04-21 04:07:59.280821+00	45	Ball Valve	3-Piece, 2 Way	1 1/2"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
5ecb1fc1-9552-4ae6-8a8c-c9cb9137a6c5	parth_valves	2026-04-21 04:07:59.280821+00	2026-04-21 04:07:59.280821+00	46	Ball Valve	3-Piece, 2 Way	1 1/2"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
9c6710c6-61d1-486e-a46b-5f0a14336898	parth_valves	2026-04-21 04:07:59.280822+00	2026-04-21 04:07:59.280822+00	47	Ball Valve	3-Piece, 2 Way	2"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
36eff881-c91c-4e89-ae21-b2b9e4706345	parth_valves	2026-04-21 04:07:59.280822+00	2026-04-21 04:07:59.280823+00	48	Ball Valve	3-Piece, 2 Way	2"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
0f9043d7-e151-4f72-9317-de2a47852a81	parth_valves	2026-04-21 04:07:59.280823+00	2026-04-21 04:07:59.280823+00	49	Ball Valve	3-Piece, 2 Way	2 1/2"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
c4cfa1f2-e9e2-4830-8b6d-235ab94bae8b	parth_valves	2026-04-21 04:07:59.280824+00	2026-04-21 04:07:59.280824+00	50	Ball Valve	3-Piece, 2 Way	2 1/2"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
ea32aede-9f2d-43ef-9f68-1971e185128c	parth_valves	2026-04-21 04:07:59.280825+00	2026-04-21 04:07:59.280825+00	52	Ball Valve	3-Piece, 2 Way	3"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
bba0a2d9-85e7-4f42-86e6-e95070564d14	parth_valves	2026-04-21 04:07:59.280826+00	2026-04-21 04:07:59.280826+00	53	Ball Valve	3-Piece, 2 Way	4"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
c0213698-c6a8-42bc-b598-a11e3c3bb3d3	parth_valves	2026-04-21 04:07:59.280826+00	2026-04-21 04:07:59.280827+00	54	Ball Valve	3-Piece, 2 Way	4"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
b29d0a0b-24a7-4c26-9830-7c329294e08a	parth_valves	2026-04-21 04:07:59.280827+00	2026-04-21 04:07:59.280827+00	55	Ball Valve	3-Piece, 2 Way	6"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
9e3cf2d5-2675-4470-a2f3-10e5c11b33b8	parth_valves	2026-04-21 04:07:59.280828+00	2026-04-21 04:07:59.280828+00	56	Ball Valve	3-Piece, 2 Way	6"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
72c7dead-99ca-4287-9fc9-ea0d03959f46	parth_valves	2026-04-21 04:07:59.280828+00	2026-04-21 04:07:59.280829+00	57	Ball Valve	3-Piece, 2 Way	8"	Full Bore	Screwed (BSP Thread)	PN6	PP	PP	MS	PTFE	MS	\N	File 14
1f87b2a7-df0c-4959-86cc-08f544fcd4bd	parth_valves	2026-04-21 04:07:59.280829+00	2026-04-21 04:07:59.280829+00	58	Ball Valve	3-Piece, 2 Way	8"	Full Bore	Screwed (BSP Thread)	PN6	HDPE	HDPE	MS	PTFE	MS	\N	File 14
264cbdc6-ffe7-4833-8680-f30fa19b695c	parth_valves	2026-04-21 04:07:59.28083+00	2026-04-21 04:07:59.28083+00	59	Ball Valve	3-Piece, 2 Way	DN25	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
0a550de3-d97d-4da9-ab08-2f6dafd8588b	parth_valves	2026-04-21 04:07:59.28083+00	2026-04-21 04:07:59.280831+00	60	Ball Valve	3-Piece, 2 Way	DN25	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
0e903fa9-f02d-49cf-a6ab-a9fbad536f17	parth_valves	2026-04-21 04:07:59.280831+00	2026-04-21 04:07:59.280831+00	61	Ball Valve	3-Piece, 2 Way	DN38	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
bfe46908-562a-4a43-9c32-d7044ebb9e62	parth_valves	2026-04-21 04:07:59.280832+00	2026-04-21 04:07:59.280832+00	62	Ball Valve	3-Piece, 2 Way	DN38	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
3ed78c2b-ceb5-49c9-a5da-85e4f6b8a770	parth_valves	2026-04-21 04:07:59.280832+00	2026-04-21 04:07:59.280833+00	63	Ball Valve	3-Piece, 2 Way	DN51	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
7825427d-c8a7-4945-9059-f0e27aa56e46	parth_valves	2026-04-21 04:07:59.280833+00	2026-04-21 04:07:59.280833+00	64	Ball Valve	3-Piece, 2 Way	DN51	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
a429ce51-5eae-4182-9bf2-a5401e85d575	parth_valves	2026-04-21 04:07:59.280834+00	2026-04-21 04:07:59.280834+00	65	Ball Valve	3-Piece, 2 Way	DN63	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
b4eba995-7be4-43d4-909d-2ce9b2752feb	parth_valves	2026-04-21 04:07:59.280834+00	2026-04-21 04:07:59.280835+00	66	Ball Valve	3-Piece, 2 Way	DN63	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
fa04f361-a62d-4fac-94a3-b549decc0d79	parth_valves	2026-04-21 04:07:59.280835+00	2026-04-21 04:07:59.280835+00	67	Ball Valve	3-Piece, 2 Way	DN76	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
a9354766-a24e-47be-8cae-cfa1b07bc817	parth_valves	2026-04-21 04:07:59.280836+00	2026-04-21 04:07:59.280836+00	68	Ball Valve	3-Piece, 2 Way	DN76	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
4232ae1f-b124-4f80-9976-ed9f90ff76ea	parth_valves	2026-04-21 04:07:59.280837+00	2026-04-21 04:07:59.280837+00	69	Ball Valve	3-Piece, 2 Way	DN100	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
4e994e0c-bf0e-4986-9ff7-b5376d5383c5	parth_valves	2026-04-21 04:07:59.280837+00	2026-04-21 04:07:59.280838+00	70	Ball Valve	3-Piece, 2 Way	DN100	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
bdddad96-c941-45f4-8738-c4c204fccda8	parth_valves	2026-04-21 04:07:59.280838+00	2026-04-21 04:07:59.280838+00	71	Ball Valve	3-Piece, 2 Way	DN25	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
8f87a01b-a802-49de-8447-81ac6ab6abde	parth_valves	2026-04-21 04:07:59.280839+00	2026-04-21 04:07:59.280839+00	72	Ball Valve	3-Piece, 2 Way	DN25	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
a80ec8c6-16b2-4536-b012-6d1ccbe04ba5	parth_valves	2026-04-21 04:07:59.280839+00	2026-04-21 04:07:59.28084+00	73	Ball Valve	3-Piece, 2 Way	DN38	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
2e958a25-b621-4807-8664-990583f264f3	parth_valves	2026-04-21 04:07:59.28084+00	2026-04-21 04:07:59.28084+00	74	Ball Valve	3-Piece, 2 Way	DN38	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
f9b1969f-1e9d-417c-a803-6a5acd8eec29	parth_valves	2026-04-21 04:07:59.280841+00	2026-04-21 04:07:59.280841+00	75	Ball Valve	3-Piece, 2 Way	DN51	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
1f3aae0b-1028-4e0e-87e6-f6d1edaa07c0	parth_valves	2026-04-21 04:07:59.280841+00	2026-04-21 04:07:59.280842+00	76	Ball Valve	3-Piece, 2 Way	DN51	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
da27380a-850c-4aff-a6a4-a62093acd825	parth_valves	2026-04-21 04:07:59.280842+00	2026-04-21 04:07:59.280842+00	77	Ball Valve	3-Piece, 2 Way	DN63	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
1c8d0e4e-9577-462e-8ae8-17d2430bf36b	parth_valves	2026-04-21 04:07:59.280843+00	2026-04-21 04:07:59.280843+00	78	Ball Valve	3-Piece, 2 Way	DN63	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
af1330b4-4b6a-41b8-a545-aa7b84cc737b	parth_valves	2026-04-21 04:07:59.280843+00	2026-04-21 04:07:59.280844+00	79	Ball Valve	3-Piece, 2 Way	DN76	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
a658ef47-5236-4bb3-ac12-2169db003468	parth_valves	2026-04-21 04:07:59.280844+00	2026-04-21 04:07:59.280844+00	80	Ball Valve	3-Piece, 2 Way	DN76	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
9fd1f533-163a-4245-98cd-0d26f7d92539	parth_valves	2026-04-21 04:07:59.280845+00	2026-04-21 04:07:59.280845+00	81	Ball Valve	3-Piece, 2 Way	DN100	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	EPDM	SS304	\N	File 18
4c55b03a-508b-4765-8e8a-f95f8e17de93	parth_valves	2026-04-21 04:07:59.280845+00	2026-04-21 04:07:59.280846+00	82	Ball Valve	3-Piece, 2 Way	DN100	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	EPDM	SS304	\N	File 18
2bdf5c92-78cd-4948-9d19-f7905e3ee4f2	parth_valves	2026-04-21 04:07:59.280846+00	2026-04-21 04:07:59.280846+00	83	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
a82b960a-0848-4ee7-88fd-62b9f0e210e5	parth_valves	2026-04-21 04:07:59.280847+00	2026-04-21 04:07:59.280847+00	84	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
683e1026-75fe-4f69-af1e-ede45ffa6eb7	parth_valves	2026-04-21 04:07:59.280847+00	2026-04-21 04:07:59.280848+00	85	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
c79c4208-ffa4-4972-8529-be75301cea7b	parth_valves	2026-04-21 04:07:59.280848+00	2026-04-21 04:07:59.280848+00	86	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
f964b673-4200-4797-aaf7-9d8728e505f7	parth_valves	2026-04-21 04:07:59.280849+00	2026-04-21 04:07:59.280849+00	87	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
8e66e8a6-0c86-4f74-a551-0710e8cf61c9	parth_valves	2026-04-21 04:07:59.280849+00	2026-04-21 04:07:59.28085+00	88	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
ad971b29-d18a-4958-8d63-e1984b05952a	parth_valves	2026-04-21 04:07:59.28085+00	2026-04-21 04:07:59.28085+00	89	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
004c1c94-7132-4e09-88b2-c3638dd54ffe	parth_valves	2026-04-21 04:07:59.280851+00	2026-04-21 04:07:59.280851+00	90	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
582b1703-9077-48ea-8115-ea6235aa0e49	parth_valves	2026-04-21 04:07:59.280851+00	2026-04-21 04:07:59.280852+00	91	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
4e42e22d-478c-4a28-b653-d31280591011	parth_valves	2026-04-21 04:07:59.280852+00	2026-04-21 04:07:59.280852+00	92	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
b8da232c-ca9a-4aa2-abd7-71511d495dc1	parth_valves	2026-04-21 04:07:59.280853+00	2026-04-21 04:07:59.280853+00	93	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
e46ed5a9-bc3d-4733-9e7b-977154184fd4	parth_valves	2026-04-21 04:07:59.280853+00	2026-04-21 04:07:59.280854+00	94	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
ad9bc320-f8c1-4f8b-b0f7-73563905dc6a	parth_valves	2026-04-21 04:07:59.280854+00	2026-04-21 04:07:59.280854+00	95	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
49767b6b-2e6f-4955-b875-864b3c981b97	parth_valves	2026-04-21 04:07:59.280855+00	2026-04-21 04:07:59.280855+00	96	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
983203a6-8809-475c-a173-013d2528f0eb	parth_valves	2026-04-21 04:07:59.280855+00	2026-04-21 04:07:59.280856+00	97	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
dadf6b6d-daae-4905-9ab2-aaf73191794f	parth_valves	2026-04-21 04:07:59.280856+00	2026-04-21 04:07:59.280856+00	98	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
5f5f1eec-c0dc-4e99-a3ec-276ab865aca2	parth_valves	2026-04-21 04:07:59.280857+00	2026-04-21 04:07:59.280857+00	99	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
21b1bfca-3a60-498f-a834-88a170862f0c	parth_valves	2026-04-21 04:07:59.280857+00	2026-04-21 04:07:59.280858+00	100	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
9289308b-441f-44aa-8b32-2163fa88886d	parth_valves	2026-04-21 04:07:59.280858+00	2026-04-21 04:07:59.280858+00	101	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
016c25a1-85d5-451f-80e6-9a93011e452c	parth_valves	2026-04-21 04:07:59.280859+00	2026-04-21 04:07:59.280859+00	102	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
9dff1c49-b3b7-449e-a443-25a32fc039e4	parth_valves	2026-04-21 04:07:59.280859+00	2026-04-21 04:07:59.28086+00	103	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
89d8a86b-8b9a-4c38-aeb9-8706974017a2	parth_valves	2026-04-21 04:07:59.28086+00	2026-04-21 04:07:59.28086+00	104	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
8be01e3c-18a8-46f3-8d0a-666d7fd4d132	parth_valves	2026-04-21 04:07:59.280861+00	2026-04-21 04:07:59.280861+00	105	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
b5429b7b-98cc-4a93-9f8d-1503a5ae6ccb	parth_valves	2026-04-21 04:07:59.280861+00	2026-04-21 04:07:59.280862+00	106	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
0953b0d6-20f4-46df-b962-09bb4b2fc421	parth_valves	2026-04-21 04:07:59.280862+00	2026-04-21 04:07:59.280862+00	107	Ball Valve	3-Piece, 2 Way	125 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
e7355c4d-4482-4b0c-bf0f-c3bf8629bcc3	parth_valves	2026-04-21 04:07:59.280863+00	2026-04-21 04:07:59.280863+00	108	Ball Valve	3-Piece, 2 Way	125 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
ff32c767-91fc-4cd2-96da-4836a4243d8f	parth_valves	2026-04-21 04:07:59.280863+00	2026-04-21 04:07:59.280864+00	109	Ball Valve	3-Piece, 2 Way	125 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
7a754c96-613f-449d-9ed8-dafa0e597455	parth_valves	2026-04-21 04:07:59.280864+00	2026-04-21 04:07:59.280864+00	110	Ball Valve	3-Piece, 2 Way	150 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
ed167dc3-459c-4038-952f-c4ab88464973	parth_valves	2026-04-21 04:07:59.280865+00	2026-04-21 04:07:59.280865+00	111	Ball Valve	3-Piece, 2 Way	150 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
c19d47c9-68b5-4bbc-b5b7-9305cb2a598e	parth_valves	2026-04-21 04:07:59.280865+00	2026-04-21 04:07:59.280866+00	112	Ball Valve	3-Piece, 2 Way	150 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
7d0574ae-8cdf-4593-8885-5578973c3a73	parth_valves	2026-04-21 04:07:59.280866+00	2026-04-21 04:07:59.280866+00	113	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
a0f45f8a-f12c-44da-acc6-2bd14648b3cb	parth_valves	2026-04-21 04:07:59.280867+00	2026-04-21 04:07:59.280867+00	114	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
6e248e21-7c14-4160-b737-0c8cbe4c2c39	parth_valves	2026-04-21 04:07:59.280867+00	2026-04-21 04:07:59.280868+00	115	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
6f04579b-34df-4967-b8b1-2ee9e363ff59	parth_valves	2026-04-21 04:07:59.280869+00	2026-04-21 04:07:59.280869+00	117	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
526761ad-aac8-4280-9959-3eee77fd337e	parth_valves	2026-04-21 04:07:59.280869+00	2026-04-21 04:07:59.28087+00	118	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
23491b77-a26a-479f-87de-525cc2318e8e	parth_valves	2026-04-21 04:07:59.28087+00	2026-04-21 04:07:59.28087+00	119	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
55371fb8-2ca3-406a-b725-0bae64e8e97e	parth_valves	2026-04-21 04:07:59.280871+00	2026-04-21 04:07:59.280871+00	120	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
9475a35e-8088-4694-9551-3196b55b1b1c	parth_valves	2026-04-21 04:07:59.280871+00	2026-04-21 04:07:59.280872+00	121	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
6062fb51-13b0-45d9-ba26-238275ba18b9	parth_valves	2026-04-21 04:07:59.280872+00	2026-04-21 04:07:59.280872+00	122	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
527c36ce-d63f-40a6-809a-bdd3413cbc72	parth_valves	2026-04-21 04:07:59.280873+00	2026-04-21 04:07:59.280873+00	123	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
ffcd890c-50cf-402f-a428-cc34ee924488	parth_valves	2026-04-21 04:07:59.280873+00	2026-04-21 04:07:59.280874+00	124	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
a7cc7d9e-cbc0-43c2-b5fa-6393c9dbce8c	parth_valves	2026-04-21 04:07:59.280874+00	2026-04-21 04:07:59.280874+00	125	Ball Valve	2-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
79574a84-1e09-4921-a2aa-51ba3d862954	parth_valves	2026-04-21 04:07:59.280875+00	2026-04-21 04:07:59.280875+00	126	Ball Valve	2-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
ccf9c3a6-518b-4986-8422-8b719581d850	parth_valves	2026-04-21 04:07:59.280875+00	2026-04-21 04:07:59.280876+00	127	Ball Valve	2-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
0c8c28a9-8620-4892-8ae6-dea63b47da3f	parth_valves	2026-04-21 04:07:59.280876+00	2026-04-21 04:07:59.280876+00	128	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
ae14a712-c8f8-4847-a4c9-bc8cda117438	parth_valves	2026-04-21 04:07:59.280877+00	2026-04-21 04:07:59.280877+00	129	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
2d51df1d-f566-4be6-935d-dd3558fb54f2	parth_valves	2026-04-21 04:07:59.280877+00	2026-04-21 04:07:59.280878+00	130	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
04498b06-9f2f-487d-8fc0-b517177d7540	parth_valves	2026-04-21 04:07:59.280878+00	2026-04-21 04:07:59.280878+00	131	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
b4741f33-f95d-4029-a4ee-a74b06d9cb3c	parth_valves	2026-04-21 04:07:59.280879+00	2026-04-21 04:07:59.280879+00	132	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
71aa6948-09ba-489a-b729-28d56d5f8107	parth_valves	2026-04-21 04:07:59.280879+00	2026-04-21 04:07:59.28088+00	133	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
074c5c36-c428-4bf5-b054-a0fa5e9c59cf	parth_valves	2026-04-21 04:07:59.28088+00	2026-04-21 04:07:59.28088+00	134	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
ef7342b3-b174-497c-953a-b1d6b5ae5d3e	parth_valves	2026-04-21 04:07:59.280881+00	2026-04-21 04:07:59.280881+00	135	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
05c7b239-ac01-4830-88f2-31bee5323a42	parth_valves	2026-04-21 04:07:59.280881+00	2026-04-21 04:07:59.280882+00	136	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
8d287949-24b5-4c59-98e6-1fe042628b32	parth_valves	2026-04-21 04:07:59.280882+00	2026-04-21 04:07:59.280882+00	137	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
fa159dce-5068-41a0-96bc-7cbbb1f4c154	parth_valves	2026-04-21 04:07:59.280883+00	2026-04-21 04:07:59.280883+00	138	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
31f42baf-0546-4818-a7af-c49f26adb4d3	parth_valves	2026-04-21 04:07:59.280883+00	2026-04-21 04:07:59.280883+00	139	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
d5a1e627-ae83-4188-b358-942bcee8acdf	parth_valves	2026-04-21 04:07:59.280892+00	2026-04-21 04:07:59.280892+00	140	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
59dd0092-d4cd-4623-9719-8008fc871bf9	parth_valves	2026-04-21 04:07:59.280892+00	2026-04-21 04:07:59.280893+00	141	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
cb44843b-2df6-49da-8d88-9528ee0faa54	parth_valves	2026-04-21 04:07:59.280893+00	2026-04-21 04:07:59.280893+00	142	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
850aae03-853c-42d3-9a50-b7ba97e2b497	parth_valves	2026-04-21 04:07:59.280894+00	2026-04-21 04:07:59.280894+00	143	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
080852ed-66a4-49aa-aa81-1ba0edc4c8ba	parth_valves	2026-04-21 04:07:59.280894+00	2026-04-21 04:07:59.280895+00	144	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
421098f4-53c7-4bfa-b5db-f0a89a5f1710	parth_valves	2026-04-21 04:07:59.280895+00	2026-04-21 04:07:59.280895+00	145	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
08ba002d-5383-4b23-8e48-d6a8b8c94428	parth_valves	2026-04-21 04:07:59.280896+00	2026-04-21 04:07:59.280896+00	146	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
b5c1608f-b708-4fdf-af51-243264b60426	parth_valves	2026-04-21 04:07:59.280896+00	2026-04-21 04:07:59.280897+00	147	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
3f5babe1-eb7c-4b4d-91d0-26594533da98	parth_valves	2026-04-21 04:07:59.280897+00	2026-04-21 04:07:59.280897+00	148	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
99b621c9-41e3-4460-ab04-b6f9091f5ab9	parth_valves	2026-04-21 04:07:59.280898+00	2026-04-21 04:07:59.280898+00	149	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
a3dbbede-ed06-4113-8165-d105a85c997c	parth_valves	2026-04-21 04:07:59.280898+00	2026-04-21 04:07:59.280899+00	150	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
b842f837-81d4-45b6-b54b-9d027c2fca08	parth_valves	2026-04-21 04:07:59.280899+00	2026-04-21 04:07:59.280899+00	151	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
05d9f07c-c898-4fe7-b17e-1e1089351396	parth_valves	2026-04-21 04:07:59.2809+00	2026-04-21 04:07:59.2809+00	152	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
7c7b0378-163b-422a-befe-67fcb83d0cc5	parth_valves	2026-04-21 04:07:59.2809+00	2026-04-21 04:07:59.280901+00	153	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
f02f8f04-0284-432c-a8a0-d63371a2cf9d	parth_valves	2026-04-21 04:07:59.280901+00	2026-04-21 04:07:59.280901+00	154	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
fdaf119c-856f-48ad-a90a-0f7db3006510	parth_valves	2026-04-21 04:07:59.280902+00	2026-04-21 04:07:59.280902+00	155	Ball Valve	2-Piece, 2 Way	20 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
7abc3bc2-4b5c-4f4c-8a2d-6cf9fcde904e	parth_valves	2026-04-21 04:07:59.280902+00	2026-04-21 04:07:59.280903+00	156	Ball Valve	2-Piece, 2 Way	20 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
99910f3f-3421-4bbe-afcc-782545c4cbea	parth_valves	2026-04-21 04:07:59.280903+00	2026-04-21 04:07:59.280903+00	157	Ball Valve	2-Piece, 2 Way	20 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
54dcbf89-eb2b-43d3-b3a7-59f10dda653d	parth_valves	2026-04-21 04:07:59.280904+00	2026-04-21 04:07:59.280904+00	158	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
f1a926f3-9e8c-421a-9dd6-d20f6bd1c606	parth_valves	2026-04-21 04:07:59.280905+00	2026-04-21 04:07:59.280905+00	159	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
50e2187d-1def-4333-8d39-3717f504908b	parth_valves	2026-04-21 04:07:59.280905+00	2026-04-21 04:07:59.280905+00	160	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
1e6c6b76-d2e1-4bbd-b875-868bd93c20d0	parth_valves	2026-04-21 04:07:59.280906+00	2026-04-21 04:07:59.280906+00	161	Ball Valve	2-Piece, 2 Way	32 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
778f1423-a36b-4c7a-9ebf-417a2161a0a2	parth_valves	2026-04-21 04:07:59.280906+00	2026-04-21 04:07:59.280907+00	162	Ball Valve	2-Piece, 2 Way	32 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
13aaeb47-4cac-43b2-acf0-73e6d18d0ad8	parth_valves	2026-04-21 04:07:59.280907+00	2026-04-21 04:07:59.280907+00	163	Ball Valve	2-Piece, 2 Way	32 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
21f43b21-bddd-48a0-87c8-0e751a533d01	parth_valves	2026-04-21 04:07:59.280908+00	2026-04-21 04:07:59.280908+00	164	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
945c0042-7288-4746-ad1b-2b8639807dad	parth_valves	2026-04-21 04:07:59.280909+00	2026-04-21 04:07:59.280909+00	165	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
e6c2e130-406e-4e49-9dc8-74cef2c5fec6	parth_valves	2026-04-21 04:07:59.280909+00	2026-04-21 04:07:59.280909+00	166	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
1a6f0b3c-58fc-4ea6-ae27-c4143784aea5	parth_valves	2026-04-21 04:07:59.28091+00	2026-04-21 04:07:59.28091+00	167	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
7aeefcc0-3ccf-41de-8385-e422f90ff044	parth_valves	2026-04-21 04:07:59.280911+00	2026-04-21 04:07:59.280911+00	168	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Screwed / Socket Weld	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
f753dec9-778a-4bdc-a9aa-9b9b74bcd49d	parth_valves	2026-04-21 04:07:59.280911+00	2026-04-21 04:07:59.280912+00	169	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Screwed / Socket Weld	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
0ba968f8-b170-4f0d-a853-1675736e0a7f	parth_valves	2026-04-21 04:07:59.280912+00	2026-04-21 04:07:59.280912+00	170	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
6370ca2d-09e8-4d5d-89bf-5f0535642aae	parth_valves	2026-04-21 04:07:59.280913+00	2026-04-21 04:07:59.280913+00	171	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
b2d07177-875a-4156-802a-a7554e5a6583	parth_valves	2026-04-21 04:07:59.280913+00	2026-04-21 04:07:59.280914+00	172	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	TC End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
da56509f-8f5a-4d63-bf02-4fec68c1cb04	parth_valves	2026-04-21 04:07:59.280914+00	2026-04-21 04:07:59.280914+00	173	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
dd1fbc62-6211-4434-9e86-ff89b6f2b390	parth_valves	2026-04-21 04:07:59.280915+00	2026-04-21 04:07:59.280915+00	174	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
6507edd4-3584-46ea-9dbc-935721ea1761	parth_valves	2026-04-21 04:07:59.280915+00	2026-04-21 04:07:59.280915+00	175	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	TC End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
6e3251cf-fd02-43a8-a701-f0d0a56b8737	parth_valves	2026-04-21 04:07:59.280916+00	2026-04-21 04:07:59.280916+00	176	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
8bdb162d-3d83-4326-8f70-7aee0f548769	parth_valves	2026-04-21 04:07:59.280917+00	2026-04-21 04:07:59.280917+00	177	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
4a3aedbc-32d8-4fb7-a43e-99c569701d9e	parth_valves	2026-04-21 04:07:59.280917+00	2026-04-21 04:07:59.280918+00	178	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	TC End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
7ac21d45-d51e-45c8-b6dc-49dc271c2bcb	parth_valves	2026-04-21 04:07:59.280918+00	2026-04-21 04:07:59.280918+00	179	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
3675e532-1f36-44c8-8d50-66ac7c39a173	parth_valves	2026-04-21 04:07:59.280919+00	2026-04-21 04:07:59.280919+00	180	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
caedc505-0bd1-4246-b4f9-9eb10a9806dd	parth_valves	2026-04-21 04:07:59.280919+00	2026-04-21 04:07:59.28092+00	181	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	TC End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
2b27cfca-55cb-452e-a18a-e9a4a245007c	parth_valves	2026-04-21 04:07:59.28092+00	2026-04-21 04:07:59.28092+00	182	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
538b6e76-3fa2-460c-8568-13d0c5569046	parth_valves	2026-04-21 04:07:59.280921+00	2026-04-21 04:07:59.280921+00	183	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
8c2ae837-76f6-482d-86ef-0b3ea9f18589	parth_valves	2026-04-21 04:07:59.280921+00	2026-04-21 04:07:59.280922+00	184	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	TC End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
a33e5a53-2112-4088-80a0-31c5bc18adf7	parth_valves	2026-04-21 04:07:59.280922+00	2026-04-21 04:07:59.280922+00	185	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
ad130941-af7b-4716-8c5d-b1fce8203484	parth_valves	2026-04-21 04:07:59.280923+00	2026-04-21 04:07:59.280923+00	186	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
28232900-8427-4bb0-930b-0ae20d3a1a3e	parth_valves	2026-04-21 04:07:59.280923+00	2026-04-21 04:07:59.280924+00	187	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	TC End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
96a6349d-9d76-4cc0-80d8-889bd7e3365d	parth_valves	2026-04-21 04:07:59.280924+00	2026-04-21 04:07:59.280924+00	188	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
ba0b926e-98b2-4913-a564-1141a8800726	parth_valves	2026-04-21 04:07:59.280925+00	2026-04-21 04:07:59.280925+00	189	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
c86f38c9-9ca9-4195-822d-2a202c054409	parth_valves	2026-04-21 04:07:59.280925+00	2026-04-21 04:07:59.280926+00	190	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	TC End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
1f1d065a-e4d9-4880-a27e-658043a575c2	parth_valves	2026-04-21 04:07:59.280926+00	2026-04-21 04:07:59.280926+00	191	Ball Valve	L-Port, 3 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
307a728d-ce04-4961-9212-a1c16754c9cf	parth_valves	2026-04-21 04:07:59.280927+00	2026-04-21 04:07:59.280927+00	192	Ball Valve	L-Port, 3 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
b7c89b72-3527-496c-80cb-125f35fc3f0e	parth_valves	2026-04-21 04:07:59.280927+00	2026-04-21 04:07:59.280928+00	193	Ball Valve	L-Port, 3 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
7c0f95cf-1873-4cff-a077-57ab3a03de23	parth_valves	2026-04-21 04:07:59.280928+00	2026-04-21 04:07:59.280928+00	194	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
a1d1e679-fb79-48ff-956d-71fdbd9681d3	parth_valves	2026-04-21 04:07:59.280929+00	2026-04-21 04:07:59.280929+00	195	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
994fb8b7-b24f-46b4-a1c1-eca091babeba	parth_valves	2026-04-21 04:07:59.280929+00	2026-04-21 04:07:59.28093+00	196	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
fa6bd58d-25e4-4ac1-8d6d-d1ccec7a40dd	parth_valves	2026-04-21 04:07:59.28093+00	2026-04-21 04:07:59.28093+00	197	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
6b2b228d-14b9-41c3-80c3-ca9aabd99b7a	parth_valves	2026-04-21 04:07:59.280931+00	2026-04-21 04:07:59.280931+00	198	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
bde92f9a-caa1-49c2-86e9-e85bdd817484	parth_valves	2026-04-21 04:07:59.280931+00	2026-04-21 04:07:59.280932+00	199	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
440814e4-e535-4102-8e6c-e27de6c46676	parth_valves	2026-04-21 04:07:59.280932+00	2026-04-21 04:07:59.280932+00	200	Ball Valve	L-Port, 3 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
bda3e551-e527-498e-a43c-2e01c7e9f1c6	parth_valves	2026-04-21 04:07:59.280933+00	2026-04-21 04:07:59.280933+00	201	Ball Valve	L-Port, 3 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
9c8e9b8e-b173-4f7e-9e31-a726f6c0089c	parth_valves	2026-04-21 04:07:59.280933+00	2026-04-21 04:07:59.280934+00	202	Ball Valve	L-Port, 3 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
3cef683f-8897-4c31-a23d-46d956180a1d	parth_valves	2026-04-21 04:07:59.280934+00	2026-04-21 04:07:59.280934+00	203	Ball Valve	L-Port, 3 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	File 49
57d4906f-a4ff-49a4-8b5f-709de7f2d4ae	parth_valves	2026-04-21 04:07:59.280935+00	2026-04-21 04:07:59.280935+00	204	Ball Valve	L-Port, 3 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	File 49
9d9c1444-655f-446d-85fe-508e0d17964f	parth_valves	2026-04-21 04:07:59.280935+00	2026-04-21 04:07:59.280936+00	205	Ball Valve	L-Port, 3 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	File 49
9bc6ee48-64ac-4f3a-acc9-94be2727efe8	parth_valves	2026-04-21 04:07:59.280936+00	2026-04-21 04:07:59.280936+00	206	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
cb405648-d050-4934-9781-ebfbc83e8a5a	parth_valves	2026-04-21 04:07:59.280937+00	2026-04-21 04:07:59.280937+00	207	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
2aff73d8-51c3-4672-8c7a-2895a86d467d	parth_valves	2026-04-21 04:07:59.280937+00	2026-04-21 04:07:59.280938+00	208	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
85fa792c-6466-4e5a-8915-349a5a48f987	parth_valves	2026-04-21 04:07:59.280938+00	2026-04-21 04:07:59.280938+00	209	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
c3c54d0a-ed3e-4587-8cb9-6a50b1c31d6a	parth_valves	2026-04-21 04:07:59.280939+00	2026-04-21 04:07:59.280939+00	210	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
e47eb75f-17f0-4363-9188-912f5f77cc7b	parth_valves	2026-04-21 04:07:59.280939+00	2026-04-21 04:07:59.28094+00	211	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
47ce8c54-48a0-41fd-919e-697f5bc35812	parth_valves	2026-04-21 04:07:59.28094+00	2026-04-21 04:07:59.28094+00	212	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
c09ffa01-4926-4777-a934-07e63513d4a9	parth_valves	2026-04-21 04:07:59.280941+00	2026-04-21 04:07:59.280941+00	213	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
be9298c5-a458-468d-874d-e7c4911fb5c8	parth_valves	2026-04-21 04:07:59.280941+00	2026-04-21 04:07:59.280942+00	214	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
78e71c00-7cf2-4bdb-bc3b-af9b91b88de5	parth_valves	2026-04-21 04:07:59.280942+00	2026-04-21 04:07:59.280942+00	215	Ball Valve	3-Piece, 2 Way	32 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
f39745ee-d51a-4675-b691-93df1259f933	parth_valves	2026-04-21 04:07:59.280943+00	2026-04-21 04:07:59.280943+00	216	Ball Valve	3-Piece, 2 Way	32 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
1e72d2ce-c7d3-4cc6-addf-12481bc4652e	parth_valves	2026-04-21 04:07:59.280943+00	2026-04-21 04:07:59.280944+00	217	Ball Valve	3-Piece, 2 Way	32 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
42f50f54-012c-4834-8761-f9201c478887	parth_valves	2026-04-21 04:07:59.280944+00	2026-04-21 04:07:59.280944+00	218	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
bff62b4b-caf0-4ea8-ae87-595cd23989c5	parth_valves	2026-04-21 04:07:59.280945+00	2026-04-21 04:07:59.280945+00	219	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
648155fd-55ca-4de5-937b-06a71c9914a0	parth_valves	2026-04-21 04:07:59.280945+00	2026-04-21 04:07:59.280945+00	220	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
e807657f-4ebe-4cbb-bac6-61fa7eb5ab46	parth_valves	2026-04-21 04:07:59.280946+00	2026-04-21 04:07:59.280946+00	221	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
55c4ace8-cb1a-436e-86c1-6a3eaffa2dee	parth_valves	2026-04-21 04:07:59.280947+00	2026-04-21 04:07:59.280947+00	222	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
0e0fe21a-a88a-4d2a-938d-b3f9d2ed55fb	parth_valves	2026-04-21 04:07:59.280947+00	2026-04-21 04:07:59.280948+00	223	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
58fe723a-5b12-4645-8bc3-c75afce96a68	parth_valves	2026-04-21 04:07:59.280948+00	2026-04-21 04:07:59.280948+00	224	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
fd00851d-db5f-4e6d-86c8-b8e715d98273	parth_valves	2026-04-21 04:07:59.280949+00	2026-04-21 04:07:59.280949+00	225	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
2b36887d-6950-4de5-9c82-668a3e3f4d4b	parth_valves	2026-04-21 04:07:59.280949+00	2026-04-21 04:07:59.28095+00	226	Ball Valve	3-Piece, 2 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
b54a66ce-1686-44aa-a03e-a0c727f09a30	parth_valves	2026-04-21 04:07:59.28095+00	2026-04-21 04:07:59.28095+00	227	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
e0b4a1db-f0ac-4119-b1a4-ebe0da8c47ee	parth_valves	2026-04-21 04:07:59.280951+00	2026-04-21 04:07:59.280951+00	228	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
fead88e2-3215-45fe-9540-6d9732726c08	parth_valves	2026-04-21 04:07:59.280951+00	2026-04-21 04:07:59.280952+00	229	Ball Valve	3-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
4f401e2f-21ee-4d94-8743-9b711073c8b7	parth_valves	2026-04-21 04:07:59.280952+00	2026-04-21 04:07:59.280952+00	230	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 50, 56
641c90bb-257c-48c0-b91a-d332e2004d26	parth_valves	2026-04-21 04:07:59.280953+00	2026-04-21 04:07:59.280953+00	231	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 50, 56
be3653e0-934e-4919-8835-07b7bc8ea812	parth_valves	2026-04-21 04:07:59.280953+00	2026-04-21 04:07:59.280953+00	232	Ball Valve	3-Piece, 2 Way	100 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 50, 56
2ef2c66a-db19-42b4-bbb4-92fe57b2bca2	parth_valves	2026-04-21 04:07:59.280954+00	2026-04-21 04:07:59.280954+00	233	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Screwed End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 51, 57
f47e889c-1397-4569-b61a-014dfde50333	parth_valves	2026-04-21 04:07:59.280955+00	2026-04-21 04:07:59.280955+00	234	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Screwed End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 51, 57
65d1b19e-4d2c-48de-bb34-f7c0a4fdc480	parth_valves	2026-04-21 04:07:59.280955+00	2026-04-21 04:07:59.280955+00	235	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Screwed End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 51, 57
7e96a971-8c32-4d94-9d78-6caa01f83fd5	parth_valves	2026-04-21 04:07:59.280956+00	2026-04-21 04:07:59.280956+00	236	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Screwed End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 51, 57
b0c384c3-6359-4140-8747-f303490641f9	parth_valves	2026-04-21 04:07:59.280957+00	2026-04-21 04:07:59.280957+00	237	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Screwed End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 51, 57
1957438a-ef50-47a4-84ca-0c05f41dee51	parth_valves	2026-04-21 04:07:59.280957+00	2026-04-21 04:07:59.280957+00	238	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Screwed End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 51, 57
b80203b0-4bf6-4f99-8ff5-a0cd1082f27f	parth_valves	2026-04-21 04:07:59.280958+00	2026-04-21 04:07:59.280958+00	239	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Screwed End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 51, 57
31c0333d-ea08-4468-8158-f5059fd00453	parth_valves	2026-04-21 04:07:59.280959+00	2026-04-21 04:07:59.280959+00	240	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Screwed End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 51, 57
3d101739-8fbe-4ffb-91f9-a4ab3dcaefbf	parth_valves	2026-04-21 04:07:59.280959+00	2026-04-21 04:07:59.280959+00	241	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Screwed End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 51, 57
0a9faa74-b345-4bb2-a823-f08014dd96eb	parth_valves	2026-04-21 04:07:59.28096+00	2026-04-21 04:07:59.28096+00	242	Ball Valve	3-Piece, 2 Way	32 MM	Full Bore	Screwed End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 51, 57
e3535b8a-5044-44a7-b11e-5902766eb2f2	parth_valves	2026-04-21 04:07:59.28096+00	2026-04-21 04:07:59.280961+00	243	Ball Valve	3-Piece, 2 Way	32 MM	Full Bore	Screwed End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 51, 57
b7e5d0e5-1fd5-480e-b124-194a530ac908	parth_valves	2026-04-21 04:07:59.280961+00	2026-04-21 04:07:59.280961+00	244	Ball Valve	3-Piece, 2 Way	32 MM	Full Bore	Screwed End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 51, 57
b5151079-0c34-448a-873c-3d81e0f1e7a6	parth_valves	2026-04-21 04:07:59.280962+00	2026-04-21 04:07:59.280962+00	245	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Screwed End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 51, 57
1661cfb5-663d-4acd-958f-6c735d99c847	parth_valves	2026-04-21 04:07:59.280962+00	2026-04-21 04:07:59.280963+00	246	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Screwed End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 51, 57
0bc21b67-bd20-4841-96f3-18fdb6526958	parth_valves	2026-04-21 04:07:59.280963+00	2026-04-21 04:07:59.280963+00	247	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Screwed End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 51, 57
6cae135e-c5a2-4655-99be-cb036a9411b4	parth_valves	2026-04-21 04:07:59.280964+00	2026-04-21 04:07:59.280964+00	248	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Screwed End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 51, 57
0fcbba96-0c86-4c62-907c-10cdaa89582b	parth_valves	2026-04-21 04:07:59.280964+00	2026-04-21 04:07:59.280965+00	249	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Screwed End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 51, 57
971ddde6-65bb-4045-b809-980df8292090	parth_valves	2026-04-21 04:07:59.280965+00	2026-04-21 04:07:59.280965+00	250	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Screwed End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 51, 57
9456f985-929c-4046-afdb-9302a7e353a6	parth_valves	2026-04-21 04:07:59.280966+00	2026-04-21 04:07:59.280966+00	251	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 52, 58
0659b194-3df8-4fb4-bdc4-82a1f13e9ca1	parth_valves	2026-04-21 04:07:59.280966+00	2026-04-21 04:07:59.280967+00	252	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 52, 58
5dbdae25-0bd5-41d2-9e64-419f17af5d23	parth_valves	2026-04-21 04:07:59.280967+00	2026-04-21 04:07:59.280967+00	253	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 52, 58
f0007c0a-1930-4f38-bb6a-727d8645f913	parth_valves	2026-04-21 04:07:59.280968+00	2026-04-21 04:07:59.280968+00	254	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 52, 58
e047d93a-a54c-4357-92aa-b6a6d8d600c8	parth_valves	2026-04-21 04:07:59.280968+00	2026-04-21 04:07:59.280969+00	255	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 52, 58
62e6035f-5f24-4b13-91eb-65b7d20b8ee2	parth_valves	2026-04-21 04:07:59.280969+00	2026-04-21 04:07:59.280969+00	256	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 52, 58
da06e52f-4147-4076-a4d7-df87d5418555	parth_valves	2026-04-21 04:07:59.28097+00	2026-04-21 04:07:59.28097+00	257	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 52, 58
0204a2a7-c0f7-44cf-b0b1-81c1d14c0d4c	parth_valves	2026-04-21 04:07:59.28097+00	2026-04-21 04:07:59.280971+00	258	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 52, 58
434ba7c2-e20e-418e-8fc3-b63f9c4305c3	parth_valves	2026-04-21 04:07:59.280971+00	2026-04-21 04:07:59.280971+00	259	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	TC End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 52, 58
77ab975a-1d0a-45f4-b991-2320df9ce6e2	parth_valves	2026-04-21 04:07:59.280972+00	2026-04-21 04:07:59.280972+00	260	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	TC End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 52, 58
df949e9f-61d6-46f7-8e89-6c5a7078d771	parth_valves	2026-04-21 04:07:59.280972+00	2026-04-21 04:07:59.280973+00	261	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Butt Weld End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 53, 59
9d810885-13fc-4e85-a84e-b0215868ff85	parth_valves	2026-04-21 04:07:59.280973+00	2026-04-21 04:07:59.280973+00	262	Ball Valve	3-Piece, 2 Way	15 MM	Full Bore	Butt Weld End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 53, 59
e2b4e23b-78d8-4ef1-a9ad-9c8668b5f012	parth_valves	2026-04-21 04:07:59.280974+00	2026-04-21 04:07:59.280974+00	263	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Butt Weld End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 53, 59
5904d562-5d47-46d9-9830-b26311dcd60f	parth_valves	2026-04-21 04:07:59.280974+00	2026-04-21 04:07:59.280975+00	264	Ball Valve	3-Piece, 2 Way	20 MM	Full Bore	Butt Weld End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 53, 59
8d242c15-9d1f-496c-9a02-96c9c6a5a0a7	parth_valves	2026-04-21 04:07:59.280975+00	2026-04-21 04:07:59.280975+00	265	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Butt Weld End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 53, 59
dc4d52ab-9d66-4dad-ac4c-1167261a798a	parth_valves	2026-04-21 04:07:59.280976+00	2026-04-21 04:07:59.280976+00	266	Ball Valve	3-Piece, 2 Way	25 MM	Full Bore	Butt Weld End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 53, 59
bd4899dc-4457-4daf-8f10-2c22a088af37	parth_valves	2026-04-21 04:07:59.280976+00	2026-04-21 04:07:59.280977+00	267	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Butt Weld End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 53, 59
a9fd2757-03b8-4fd8-b6af-517f46f915c0	parth_valves	2026-04-21 04:07:59.280977+00	2026-04-21 04:07:59.280977+00	268	Ball Valve	3-Piece, 2 Way	40 MM	Full Bore	Butt Weld End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 53, 59
24dda1db-181d-4ffd-bec3-2fe147762f25	parth_valves	2026-04-21 04:07:59.280978+00	2026-04-21 04:07:59.280978+00	269	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Butt Weld End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 53, 59
eb7221da-f086-490d-9940-ba9a4b083efc	parth_valves	2026-04-21 04:07:59.280978+00	2026-04-21 04:07:59.280979+00	270	Ball Valve	3-Piece, 2 Way	50 MM	Full Bore	Butt Weld End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 53, 59
978cc9df-c136-4d84-b7bc-d1d2289745f8	parth_valves	2026-04-21 04:07:59.280979+00	2026-04-21 04:07:59.280979+00	271	Ball Valve	L-Port, 3 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 54, 60
a5592bb3-9f78-45ee-bdc2-4c2a636f6aba	parth_valves	2026-04-21 04:07:59.28098+00	2026-04-21 04:07:59.28098+00	272	Ball Valve	L-Port, 3 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 54, 60
d8a56c92-9fb9-42eb-8c18-34b05e211e54	parth_valves	2026-04-21 04:07:59.28098+00	2026-04-21 04:07:59.280981+00	273	Ball Valve	L-Port, 3 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 54, 60
080b08b7-42d0-4890-9505-020500ff8a95	parth_valves	2026-04-21 04:07:59.280981+00	2026-04-21 04:07:59.280981+00	274	Ball Valve	L-Port, 3 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 54, 60
d88775e6-ebff-41d8-a03f-4327eca71ab2	parth_valves	2026-04-21 04:07:59.280982+00	2026-04-21 04:07:59.280982+00	275	Ball Valve	L-Port, 3 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 54, 60
a540bbf2-12db-45da-abb0-7a97e0c7037a	parth_valves	2026-04-21 04:07:59.280982+00	2026-04-21 04:07:59.280983+00	276	Ball Valve	L-Port, 3 Way	20 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 54, 60
4bea2728-05b3-4e03-831c-56c941074310	parth_valves	2026-04-21 04:07:59.280983+00	2026-04-21 04:07:59.280983+00	277	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 54, 60
1729f5d2-ad5d-4157-aa52-7575505b1f92	parth_valves	2026-04-21 04:07:59.280984+00	2026-04-21 04:07:59.280984+00	278	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 54, 60
6d4fb5f5-2616-46cf-9d69-511fe1e475a7	parth_valves	2026-04-21 04:07:59.280984+00	2026-04-21 04:07:59.280984+00	279	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 54, 60
8c0317c7-09fc-4899-be18-70cbde9182af	parth_valves	2026-04-21 04:07:59.280985+00	2026-04-21 04:07:59.280985+00	280	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 54, 60
adb75afe-c5af-4442-8494-b12c0afb2ee9	parth_valves	2026-04-21 04:07:59.280985+00	2026-04-21 04:07:59.280986+00	281	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 54, 60
1578b6fb-875d-4986-a1a3-8d3ffb128d40	parth_valves	2026-04-21 04:07:59.280986+00	2026-04-21 04:07:59.280986+00	282	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 54, 60
60e7bfbe-ac72-4fbb-8b7e-533b53aa6921	parth_valves	2026-04-21 04:07:59.280987+00	2026-04-21 04:07:59.280987+00	283	Ball Valve	L-Port, 3 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 54, 60
1c3dba19-9ef2-4bcd-b322-9e52e38d3cc0	parth_valves	2026-04-21 04:07:59.280987+00	2026-04-21 04:07:59.280988+00	284	Ball Valve	L-Port, 3 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 54, 60
e7e39654-5ddc-4556-a6a0-314c314a93a6	parth_valves	2026-04-21 04:07:59.280988+00	2026-04-21 04:07:59.280988+00	285	Ball Valve	L-Port, 3 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 54, 60
814f0095-7ee3-4938-9b5e-e35ff1bace6f	parth_valves	2026-04-21 04:07:59.280989+00	2026-04-21 04:07:59.280989+00	286	Ball Valve	L-Port, 3 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 54, 60
0deea670-28f4-4848-be1e-1b82973cc617	parth_valves	2026-04-21 04:07:59.280989+00	2026-04-21 04:07:59.28099+00	287	Ball Valve	L-Port, 3 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 54, 60
b1f76e41-4bd3-4238-b993-87708d054f80	parth_valves	2026-04-21 04:07:59.28099+00	2026-04-21 04:07:59.28099+00	288	Ball Valve	L-Port, 3 Way	65 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 54, 60
52b76cd6-5a6f-4cac-98b7-16cd3b855ea8	parth_valves	2026-04-21 04:07:59.280991+00	2026-04-21 04:07:59.280991+00	289	Ball Valve	L-Port, 3 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 54, 60
dda34578-41d3-480d-846b-d49c4800b238	parth_valves	2026-04-21 04:07:59.280991+00	2026-04-21 04:07:59.280992+00	290	Ball Valve	L-Port, 3 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 54, 60
cd49c0a5-c07c-4c22-b3ef-ec992d26db1b	parth_valves	2026-04-21 04:07:59.280992+00	2026-04-21 04:07:59.280992+00	291	Ball Valve	L-Port, 3 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 54, 60
4a7ad4c4-c50f-4c94-be96-56117ab0af17	parth_valves	2026-04-21 04:07:59.280993+00	2026-04-21 04:07:59.280993+00	292	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Screwed End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 55, 61
ff329358-5cbf-4d13-ad95-dd6afdad8183	parth_valves	2026-04-21 04:07:59.280993+00	2026-04-21 04:07:59.280994+00	293	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Screwed End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 55, 61
04300d26-0df7-49c6-b866-420d0132e6fa	parth_valves	2026-04-21 04:07:59.280994+00	2026-04-21 04:07:59.280994+00	294	Ball Valve	L-Port, 3 Way	25 MM	Full Bore	Screwed End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 55, 61
ac5c43e0-1a22-4be2-8d1f-5cd10f8339fb	parth_valves	2026-04-21 04:07:59.280995+00	2026-04-21 04:07:59.280995+00	295	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Screwed End	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 55, 61
d1797697-36f4-4006-a4e5-66b182abd1fc	parth_valves	2026-04-21 04:07:59.280995+00	2026-04-21 04:07:59.280996+00	296	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Screwed End	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 55, 61
b68d3c6c-a351-4aff-8b15-9e4d6ba75d85	parth_valves	2026-04-21 04:07:59.280996+00	2026-04-21 04:07:59.280996+00	297	Ball Valve	L-Port, 3 Way	40 MM	Full Bore	Screwed End	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 55, 61
7870148b-d074-4924-b8f0-332b92d072da	parth_valves	2026-04-21 04:07:59.280997+00	2026-04-21 04:07:59.280997+00	298	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 62, 63
71b64edc-3ed1-4de9-ae80-4ac6af263e20	parth_valves	2026-04-21 04:07:59.280997+00	2026-04-21 04:07:59.280998+00	299	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 62, 63
ebc06a73-e849-4aeb-9f2c-f06c4ab1d698	parth_valves	2026-04-21 04:07:59.280998+00	2026-04-21 04:07:59.280998+00	300	Ball Valve	2-Piece, 2 Way	15 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 62, 63
a8039758-3d0b-43ca-a702-46e696bccfd9	parth_valves	2026-04-21 04:07:59.280999+00	2026-04-21 04:07:59.280999+00	301	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 62, 63
baa20948-27ff-4846-a4ca-a25a9ff6f9cc	parth_valves	2026-04-21 04:07:59.280999+00	2026-04-21 04:07:59.281+00	302	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 62, 63
b8671739-5d81-48a6-9699-35c104737331	parth_valves	2026-04-21 04:07:59.281+00	2026-04-21 04:07:59.281+00	303	Ball Valve	2-Piece, 2 Way	25 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 62, 63
eba18211-4a96-4004-9933-187b2ea0c005	parth_valves	2026-04-21 04:07:59.281001+00	2026-04-21 04:07:59.281001+00	304	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 62, 63
4b070149-b7a4-43dd-b142-3bf7897298c7	parth_valves	2026-04-21 04:07:59.281001+00	2026-04-21 04:07:59.281002+00	305	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 62, 63
8690f863-19c9-4ba8-89b4-8212f01c9b2f	parth_valves	2026-04-21 04:07:59.281002+00	2026-04-21 04:07:59.281002+00	306	Ball Valve	2-Piece, 2 Way	40 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 62, 63
70a3b682-f9d2-4620-b3a5-6d314f33142b	parth_valves	2026-04-21 04:07:59.281003+00	2026-04-21 04:07:59.281003+00	307	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 62, 63
e85c6dea-b651-4463-aa30-34b0a358a0c9	parth_valves	2026-04-21 04:07:59.281003+00	2026-04-21 04:07:59.281004+00	308	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 62, 63
4caa9cda-347e-485d-8ed1-b4c335c22086	parth_valves	2026-04-21 04:07:59.281004+00	2026-04-21 04:07:59.281004+00	309	Ball Valve	2-Piece, 2 Way	50 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 62, 63
0760fa8c-7ee6-4e9c-8d46-85d3340b2dad	parth_valves	2026-04-21 04:07:59.281005+00	2026-04-21 04:07:59.281005+00	310	Ball Valve	2-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8M	CF8M	SS316	PTFE	MS	\N	Files 62, 63
b58c5a01-1fe3-460f-959c-96efb084ba82	parth_valves	2026-04-21 04:07:59.281005+00	2026-04-21 04:07:59.281006+00	311	Ball Valve	2-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	CF8	CF8	SS316	PTFE	MS	\N	Files 62, 63
6be28fe4-82c7-488e-94b4-6f8caf0299df	parth_valves	2026-04-21 04:07:59.281006+00	2026-04-21 04:07:59.281006+00	312	Ball Valve	2-Piece, 2 Way	80 MM	Full Bore	Flanged (ASME B16.5 #150)	Class 150#	WCB	CF8	SS316	PTFE	MS	\N	Files 62, 63
\.


--
-- Data for Name: catalog_brackets_coupler; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.catalog_brackets_coupler (row_id, client_id, created_at, updated_at, bracket_operator, construct, size_text, price_inr) FROM stdin;
17ae0fc6-41d3-40ba-a0a4-eb2cbc455e7d	parth_valves	2026-04-21 04:07:59.311469+00	2026-04-21 04:07:59.311473+00	Ball valve	Bracket & Coupler	1/2"	800
744922b4-09b5-40b5-971f-f3d58767cd09	parth_valves	2026-04-21 04:07:59.311474+00	2026-04-21 04:07:59.311474+00	Ball valve	Bracket & Coupler	3/4"	800
f578c691-3696-48ed-880f-788c42281701	parth_valves	2026-04-21 04:07:59.311474+00	2026-04-21 04:07:59.311475+00	Ball valve	Bracket & Coupler	1"	800
5ecb492d-d461-4f30-8b95-7734c17a69b8	parth_valves	2026-04-21 04:07:59.311475+00	2026-04-21 04:07:59.311476+00	Ball valve	Bracket & Coupler	1 1/4"	1050
f20396cb-3195-45c1-b38d-4e4b3da5a83a	parth_valves	2026-04-21 04:07:59.311476+00	2026-04-21 04:07:59.311476+00	Ball valve	Bracket & Coupler	1 1/2"	1050
e85ee60c-0e7e-4d68-98ac-12b0e6cba805	parth_valves	2026-04-21 04:07:59.311477+00	2026-04-21 04:07:59.311477+00	Ball valve	Bracket & Coupler	2"	1250
9102aa00-3e56-41d7-87e6-86fa4d388360	parth_valves	2026-04-21 04:07:59.311477+00	2026-04-21 04:07:59.311478+00	Ball valve	Bracket & Coupler	2 1/2"	1250
64a30677-8b98-46f4-bce4-af4dc2313b2a	parth_valves	2026-04-21 04:07:59.311478+00	2026-04-21 04:07:59.311479+00	Ball valve	Bracket & Coupler	3"	1400
6445102e-75ff-4d69-86c6-bed1c45383c9	parth_valves	2026-04-21 04:07:59.311479+00	2026-04-21 04:07:59.311479+00	Ball valve	Bracket & Coupler	4"	1400
11700b66-5c31-466f-9756-91dd04bd8c4b	parth_valves	2026-04-21 04:07:59.31148+00	2026-04-21 04:07:59.31148+00	Ball valve	Bracket & Coupler	5"	1600
8b11164e-796a-4774-b304-ac359d41b69e	parth_valves	2026-04-21 04:07:59.311481+00	2026-04-21 04:07:59.311481+00	Ball valve	Bracket & Coupler	6"	1600
\.


--
-- Data for Name: catalog_butterfly_valve; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.catalog_butterfly_valve (row_id, client_id, created_at, updated_at, sr_no, variant_type, construction, valve_size, bore_type, end_connection, pressure, body, ball_disc, stem, seat, fasteners, price_inr, source_file) FROM stdin;
8db07334-045a-4e09-b419-ac992a2069c2	parth_valves	2026-04-21 04:07:59.188612+00	2026-04-21 04:07:59.18862+00	1	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
b93346f5-2b6a-4611-8f46-d282a72b067d	parth_valves	2026-04-21 04:07:59.188621+00	2026-04-21 04:07:59.188622+00	2	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
9c18dfc5-8e8b-4bae-83ab-7d9e81ff9a7a	parth_valves	2026-04-21 04:07:59.188622+00	2026-04-21 04:07:59.188623+00	3	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
3c7a461d-330a-4656-a26e-d58407a90d5f	parth_valves	2026-04-21 04:07:59.188623+00	2026-04-21 04:07:59.188623+00	4	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
d6324a90-9461-46a5-a872-0eec62e65b6c	parth_valves	2026-04-21 04:07:59.188624+00	2026-04-21 04:07:59.188624+00	5	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
04259632-ed19-469a-b3bb-3afe3d156def	parth_valves	2026-04-21 04:07:59.188625+00	2026-04-21 04:07:59.188625+00	6	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
bb68ea7c-3688-46d2-884d-dc177f910598	parth_valves	2026-04-21 04:07:59.188625+00	2026-04-21 04:07:59.188626+00	7	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
abf635a3-4821-4d10-815c-b1a4c22cc14a	parth_valves	2026-04-21 04:07:59.188626+00	2026-04-21 04:07:59.188626+00	8	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
1c4241cc-59df-4419-ae84-41f6d48d03fd	parth_valves	2026-04-21 04:07:59.188627+00	2026-04-21 04:07:59.188627+00	9	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
d5a83d2f-7d07-4764-a1fa-16e70e51c2dc	parth_valves	2026-04-21 04:07:59.188628+00	2026-04-21 04:07:59.188628+00	10	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
8eb0b39c-f8dd-4ce6-b338-0bddd0fe3cd0	parth_valves	2026-04-21 04:07:59.188628+00	2026-04-21 04:07:59.188629+00	11	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
a6c0ff57-8bd1-433f-bb65-d1efb9664aa8	parth_valves	2026-04-21 04:07:59.188629+00	2026-04-21 04:07:59.188629+00	12	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
91008a4f-e780-4cea-9cc8-90418a586f11	parth_valves	2026-04-21 04:07:59.18863+00	2026-04-21 04:07:59.18863+00	13	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
1734d623-8a96-4ee3-b9b1-1156c6edc4a5	parth_valves	2026-04-21 04:07:59.188631+00	2026-04-21 04:07:59.188631+00	14	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
5f7553cb-f12a-4df0-90ed-0e23be1c3f8c	parth_valves	2026-04-21 04:07:59.188631+00	2026-04-21 04:07:59.188632+00	15	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
9ed2c2f6-3526-494f-98c6-6e775d40d889	parth_valves	2026-04-21 04:07:59.188632+00	2026-04-21 04:07:59.188632+00	16	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
2d617afd-33fd-4951-a97a-ae09e08d1040	parth_valves	2026-04-21 04:07:59.188633+00	2026-04-21 04:07:59.188633+00	17	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
458c311f-f0ea-4915-a8b3-c58ce9314f14	parth_valves	2026-04-21 04:07:59.188634+00	2026-04-21 04:07:59.188634+00	18	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
a9a317d8-34e3-4787-96cd-6ff78a6a56e0	parth_valves	2026-04-21 04:07:59.188634+00	2026-04-21 04:07:59.188635+00	19	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
a3d7d822-ae10-4a44-bf11-ce2935af9632	parth_valves	2026-04-21 04:07:59.188635+00	2026-04-21 04:07:59.188635+00	20	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
b43400ec-dc25-4e29-b7d0-47cb7073c045	parth_valves	2026-04-21 04:07:59.188636+00	2026-04-21 04:07:59.188636+00	21	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN04	AL	SS304	SS304	White EPDM	MS	\N	File 1
99822f45-4437-43fc-9a16-549986287c3c	parth_valves	2026-04-21 04:07:59.188636+00	2026-04-21 04:07:59.188637+00	22	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN04	AL	SS316	SS304	White EPDM	MS	\N	File 1
c456b15e-9c49-4cb4-802e-35ff5169c5bf	parth_valves	2026-04-21 04:07:59.188637+00	2026-04-21 04:07:59.188637+00	23	Butterfly Valve	1-Piece, 2 Way	1/2"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
5af6ad4d-d5ff-4001-b30d-2a4147a7f147	parth_valves	2026-04-21 04:07:59.188638+00	2026-04-21 04:07:59.188638+00	24	Butterfly Valve	1-Piece, 2 Way	3/4"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
9444582a-001b-4b84-9c21-9fbe0872022a	parth_valves	2026-04-21 04:07:59.188639+00	2026-04-21 04:07:59.188639+00	25	Butterfly Valve	1-Piece, 2 Way	1"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
684f66ea-3e69-4830-9914-bb44ce68fd80	parth_valves	2026-04-21 04:07:59.188639+00	2026-04-21 04:07:59.18864+00	26	Butterfly Valve	1-Piece, 2 Way	1 1/4"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
de8d0b9a-ccb1-48bf-9b3d-3462d548e7db	parth_valves	2026-04-21 04:07:59.18864+00	2026-04-21 04:07:59.18864+00	27	Butterfly Valve	1-Piece, 2 Way	1 1/2"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
f8b5285d-cfc8-4cf6-b868-1bbba4f304ac	parth_valves	2026-04-21 04:07:59.188641+00	2026-04-21 04:07:59.188641+00	28	Butterfly Valve	1-Piece, 2 Way	2"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
019bf6d1-fa31-43c6-bef3-b4403f884b8f	parth_valves	2026-04-21 04:07:59.188641+00	2026-04-21 04:07:59.188642+00	29	Butterfly Valve	1-Piece, 2 Way	2 1/2"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
b2346c21-4d1a-4ec5-9636-ebc32e67ab50	parth_valves	2026-04-21 04:07:59.188642+00	2026-04-21 04:07:59.188642+00	30	Butterfly Valve	1-Piece, 2 Way	3"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
7f31c36a-7bbb-468b-81d7-e3f2a34c343b	parth_valves	2026-04-21 04:07:59.188643+00	2026-04-21 04:07:59.188643+00	31	Butterfly Valve	1-Piece, 2 Way	4"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
9c0e63ec-2dcb-450d-ac3b-f653d53aa6ba	parth_valves	2026-04-21 04:07:59.188644+00	2026-04-21 04:07:59.188644+00	32	Butterfly Valve	1-Piece, 2 Way	6"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
63e98c17-b617-4a49-bd5f-c4258cbcf6ab	parth_valves	2026-04-21 04:07:59.188644+00	2026-04-21 04:07:59.188645+00	33	Butterfly Valve	1-Piece, 2 Way	8"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
bf553a5f-3292-498d-b90a-85dc2a7fbbab	parth_valves	2026-04-21 04:07:59.188645+00	2026-04-21 04:07:59.188645+00	34	Butterfly Valve	1-Piece, 2 Way	10"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
18957f0c-4982-46a2-b44a-5dfd055af208	parth_valves	2026-04-21 04:07:59.188646+00	2026-04-21 04:07:59.188646+00	35	Butterfly Valve	1-Piece, 2 Way	12"	Full Bore	Flanged (ASA #150)	PN6	PP	PP	EN8	Neoprene / EPDM	MS	\N	File 10
107ffd63-745f-4268-bad9-e23e8cbfa94b	parth_valves	2026-04-21 04:07:59.188646+00	2026-04-21 04:07:59.188647+00	36	Butterfly Valve	1-Piece, 2 Way	DN25	Full Bore	Butt Weld	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
e1900e29-fe9a-4595-9edc-c17972920689	parth_valves	2026-04-21 04:07:59.188647+00	2026-04-21 04:07:59.188647+00	37	Butterfly Valve	1-Piece, 2 Way	DN38	Full Bore	Butt Weld	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
64013d26-37ae-415c-95a5-548dd40a5f01	parth_valves	2026-04-21 04:07:59.188648+00	2026-04-21 04:07:59.188648+00	38	Butterfly Valve	1-Piece, 2 Way	DN51	Full Bore	Butt Weld	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
3050e94a-b9a7-4a4b-b52b-3c9f86907de2	parth_valves	2026-04-21 04:07:59.188649+00	2026-04-21 04:07:59.188649+00	39	Butterfly Valve	1-Piece, 2 Way	DN63	Full Bore	Butt Weld	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
bdca95ff-ddd4-41de-b60b-8bfbd1db2dc1	parth_valves	2026-04-21 04:07:59.188649+00	2026-04-21 04:07:59.18865+00	40	Butterfly Valve	1-Piece, 2 Way	DN76	Full Bore	Butt Weld	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
895926b8-5647-422a-9646-18e189014566	parth_valves	2026-04-21 04:07:59.18865+00	2026-04-21 04:07:59.18865+00	41	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Butt Weld	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
eb190e53-0d68-44e8-b7fa-f7900eeab759	parth_valves	2026-04-21 04:07:59.188651+00	2026-04-21 04:07:59.188651+00	42	Butterfly Valve	1-Piece, 2 Way	DN25	Full Bore	Butt Weld	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
ccd85f2b-e09d-4cbe-92a5-bbb8834261ae	parth_valves	2026-04-21 04:07:59.188651+00	2026-04-21 04:07:59.188652+00	43	Butterfly Valve	1-Piece, 2 Way	DN38	Full Bore	Butt Weld	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
967ab4f8-0be9-4e72-8e03-435b9aeae0dd	parth_valves	2026-04-21 04:07:59.188652+00	2026-04-21 04:07:59.188653+00	44	Butterfly Valve	1-Piece, 2 Way	DN51	Full Bore	Butt Weld	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
cbf25a57-b068-4d30-80b6-31f910696ed7	parth_valves	2026-04-21 04:07:59.188653+00	2026-04-21 04:07:59.188653+00	45	Butterfly Valve	1-Piece, 2 Way	DN63	Full Bore	Butt Weld	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
db810eca-a151-428b-8262-e7418312fa0c	parth_valves	2026-04-21 04:07:59.188654+00	2026-04-21 04:07:59.188654+00	46	Butterfly Valve	1-Piece, 2 Way	DN76	Full Bore	Butt Weld	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
fc1a01a1-34b1-4b68-a9cd-4da91a8bb220	parth_valves	2026-04-21 04:07:59.188654+00	2026-04-21 04:07:59.188655+00	47	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Butt Weld	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
0d2e00f4-e5c0-4165-8434-c26211717b17	parth_valves	2026-04-21 04:07:59.188655+00	2026-04-21 04:07:59.188655+00	48	Butterfly Valve	1-Piece, 2 Way	DN25	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
91f00f2a-4b99-42b7-89c6-b7fd66208eee	parth_valves	2026-04-21 04:07:59.188656+00	2026-04-21 04:07:59.188656+00	49	Butterfly Valve	1-Piece, 2 Way	DN38	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
e9336ba5-fc32-41b9-9a99-2801ebd14d5a	parth_valves	2026-04-21 04:07:59.188657+00	2026-04-21 04:07:59.188657+00	50	Butterfly Valve	1-Piece, 2 Way	DN51	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
f327569d-878b-4bab-b455-6f740f0404c8	parth_valves	2026-04-21 04:07:59.188657+00	2026-04-21 04:07:59.188658+00	51	Butterfly Valve	1-Piece, 2 Way	DN63	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
14aafe6e-567b-4949-8dc0-4c509d81009a	parth_valves	2026-04-21 04:07:59.188658+00	2026-04-21 04:07:59.188658+00	52	Butterfly Valve	1-Piece, 2 Way	DN76	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
607c428f-c1fc-450b-b90c-cfce7c6f3b38	parth_valves	2026-04-21 04:07:59.188659+00	2026-04-21 04:07:59.188659+00	53	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	TC End	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
71af77dd-70c5-46c5-9deb-0a1447c393bb	parth_valves	2026-04-21 04:07:59.188659+00	2026-04-21 04:07:59.18866+00	54	Butterfly Valve	1-Piece, 2 Way	DN25	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
57e6be97-9073-44c8-90b7-2c788630584e	parth_valves	2026-04-21 04:07:59.18866+00	2026-04-21 04:07:59.18866+00	55	Butterfly Valve	1-Piece, 2 Way	DN38	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
31547656-9ded-444a-9c84-80fca4b5cc5d	parth_valves	2026-04-21 04:07:59.188661+00	2026-04-21 04:07:59.188661+00	56	Butterfly Valve	1-Piece, 2 Way	DN51	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
e90ddd62-d23b-49c1-a697-0ffc9048ad09	parth_valves	2026-04-21 04:07:59.188661+00	2026-04-21 04:07:59.188662+00	57	Butterfly Valve	1-Piece, 2 Way	DN63	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
6473de9c-1000-4700-a1af-42dd1e1f3136	parth_valves	2026-04-21 04:07:59.188662+00	2026-04-21 04:07:59.188663+00	58	Butterfly Valve	1-Piece, 2 Way	DN76	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
e23b1a79-6c8d-4341-ae77-b0f5fa6200b3	parth_valves	2026-04-21 04:07:59.188663+00	2026-04-21 04:07:59.188663+00	59	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	TC End	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
e34cc286-f021-4157-ac64-816fb5d377bc	parth_valves	2026-04-21 04:07:59.188664+00	2026-04-21 04:07:59.188664+00	60	Butterfly Valve	1-Piece, 2 Way	DN25	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
e295deef-2b8e-4a8f-8e7d-ddc9397d4268	parth_valves	2026-04-21 04:07:59.188664+00	2026-04-21 04:07:59.188665+00	61	Butterfly Valve	1-Piece, 2 Way	DN38	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
8749ec5f-fe63-4a0a-8afd-2ba40021cd63	parth_valves	2026-04-21 04:07:59.188665+00	2026-04-21 04:07:59.188665+00	62	Butterfly Valve	1-Piece, 2 Way	DN51	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
b32bf2e4-b88f-4d95-bfc1-3000a9947ddd	parth_valves	2026-04-21 04:07:59.188666+00	2026-04-21 04:07:59.188666+00	63	Butterfly Valve	1-Piece, 2 Way	DN63	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
ce83bc07-1d83-406c-8cf4-3bed22abfbc0	parth_valves	2026-04-21 04:07:59.188666+00	2026-04-21 04:07:59.188667+00	64	Butterfly Valve	1-Piece, 2 Way	DN76	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
7c8f74c6-5af1-478f-9c5b-6ffd92abb23f	parth_valves	2026-04-21 04:07:59.188667+00	2026-04-21 04:07:59.188667+00	65	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	SMS Union	PN10	SS304L	SS304L	SS304L	White EPDM	SS304	\N	File 17
f849c668-14af-41b3-bde2-aef15c4e74a0	parth_valves	2026-04-21 04:07:59.188668+00	2026-04-21 04:07:59.188668+00	66	Butterfly Valve	1-Piece, 2 Way	DN25	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
36dbe484-c412-4771-8ab1-c545c6d404f9	parth_valves	2026-04-21 04:07:59.188669+00	2026-04-21 04:07:59.188669+00	67	Butterfly Valve	1-Piece, 2 Way	DN38	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
87014cdd-b60f-490b-bdac-9aafc897a8c5	parth_valves	2026-04-21 04:07:59.188669+00	2026-04-21 04:07:59.18867+00	68	Butterfly Valve	1-Piece, 2 Way	DN51	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
21b5713e-e2fc-499e-b89c-414233cffad1	parth_valves	2026-04-21 04:07:59.18867+00	2026-04-21 04:07:59.18867+00	69	Butterfly Valve	1-Piece, 2 Way	DN63	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
8ac0748c-46fe-4099-8a2f-c19a19b3f6d3	parth_valves	2026-04-21 04:07:59.188671+00	2026-04-21 04:07:59.188671+00	70	Butterfly Valve	1-Piece, 2 Way	DN76	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
81eee47f-a62c-43c0-b1df-e79ab8106f38	parth_valves	2026-04-21 04:07:59.188671+00	2026-04-21 04:07:59.188672+00	71	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	SMS Union	PN10	SS316L	SS316L	SS304L	White EPDM	SS316	\N	File 17
63ba5726-12f8-4574-8b85-727df38c1876	parth_valves	2026-04-21 04:07:59.188672+00	2026-04-21 04:07:59.188672+00	72	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
22460ddd-e8f8-4b05-9cae-aeefa4a0b638	parth_valves	2026-04-21 04:07:59.188673+00	2026-04-21 04:07:59.188673+00	73	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
864b252c-4827-4135-b835-f1381ab08eeb	parth_valves	2026-04-21 04:07:59.188673+00	2026-04-21 04:07:59.188674+00	74	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f6cc5690-cf91-4c10-b43f-32176f9d1ec1	parth_valves	2026-04-21 04:07:59.188674+00	2026-04-21 04:07:59.188674+00	75	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
aa95e151-0ba9-4320-b0ae-3f07f0b776c9	parth_valves	2026-04-21 04:07:59.188675+00	2026-04-21 04:07:59.188675+00	76	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
2ac61342-4488-4645-ba01-743876b976ab	parth_valves	2026-04-21 04:07:59.188676+00	2026-04-21 04:07:59.188676+00	77	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
657d93dc-ae56-42d8-aff9-3ca6c3a320ff	parth_valves	2026-04-21 04:07:59.188676+00	2026-04-21 04:07:59.188677+00	78	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5f89f84a-2765-47bc-b630-cd5899929d96	parth_valves	2026-04-21 04:07:59.188677+00	2026-04-21 04:07:59.188677+00	79	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
d583b2b5-ab87-4b20-9ba2-a74762f58a35	parth_valves	2026-04-21 04:07:59.188678+00	2026-04-21 04:07:59.188678+00	80	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
2970b1ce-6b7c-4f9d-ab78-3d0dacda1fc0	parth_valves	2026-04-21 04:07:59.188679+00	2026-04-21 04:07:59.188679+00	81	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
94812702-2617-4113-a736-7e6ce0e0d480	parth_valves	2026-04-21 04:07:59.188679+00	2026-04-21 04:07:59.18868+00	82	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b3d36f25-6c35-4452-8621-cd0a741716eb	parth_valves	2026-04-21 04:07:59.18868+00	2026-04-21 04:07:59.18868+00	83	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f8f12da2-74aa-4cc0-9bb5-a6674bd1c063	parth_valves	2026-04-21 04:07:59.188681+00	2026-04-21 04:07:59.188681+00	84	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0a3b1a07-2f1c-4cae-a0dc-eef04ad54b4d	parth_valves	2026-04-21 04:07:59.188681+00	2026-04-21 04:07:59.188682+00	85	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f4db06ea-6850-4163-a590-06981b112115	parth_valves	2026-04-21 04:07:59.188682+00	2026-04-21 04:07:59.188682+00	86	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
d0aed744-ebf1-4f4c-b441-5c4e51607a00	parth_valves	2026-04-21 04:07:59.188683+00	2026-04-21 04:07:59.188683+00	87	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
50f2b5d1-fbef-4195-a43d-54c97e679d54	parth_valves	2026-04-21 04:07:59.188683+00	2026-04-21 04:07:59.188684+00	88	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ad5eb843-b17e-438f-8566-a97e81b08d2b	parth_valves	2026-04-21 04:07:59.188684+00	2026-04-21 04:07:59.188685+00	89	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ba993d72-e7a4-412e-85ac-5da5ad88842b	parth_valves	2026-04-21 04:07:59.188685+00	2026-04-21 04:07:59.188685+00	90	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
bb546b95-2f3a-4143-a18b-e65acf9ae316	parth_valves	2026-04-21 04:07:59.188686+00	2026-04-21 04:07:59.188686+00	91	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
7aa3d4f5-dde8-4e14-ada6-39a85a1425b7	parth_valves	2026-04-21 04:07:59.188686+00	2026-04-21 04:07:59.188687+00	92	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c04664d5-6c18-4ba5-89c0-9d851d306c43	parth_valves	2026-04-21 04:07:59.188687+00	2026-04-21 04:07:59.188687+00	93	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b88a64ad-2754-4105-ab6d-150a5cf0ee9e	parth_valves	2026-04-21 04:07:59.188688+00	2026-04-21 04:07:59.188688+00	94	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
96ca90e2-cb34-459c-addb-2d869410883f	parth_valves	2026-04-21 04:07:59.188688+00	2026-04-21 04:07:59.188689+00	95	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ed510653-9fa8-4176-a83e-76390f02cfa8	parth_valves	2026-04-21 04:07:59.188689+00	2026-04-21 04:07:59.188689+00	96	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a3665c1a-07f7-432f-8917-9dcec164e6c0	parth_valves	2026-04-21 04:07:59.18869+00	2026-04-21 04:07:59.18869+00	97	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8ba99ea8-2c7b-4e1f-81fe-9eca17af4a11	parth_valves	2026-04-21 04:07:59.188691+00	2026-04-21 04:07:59.188691+00	98	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c056acb0-8c07-4304-9c39-2d02d9788d0b	parth_valves	2026-04-21 04:07:59.188691+00	2026-04-21 04:07:59.188692+00	99	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f23b1a6e-2bf9-4e6e-8a91-80867679561e	parth_valves	2026-04-21 04:07:59.188692+00	2026-04-21 04:07:59.188692+00	100	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
1ca3a224-9559-467b-960b-a5fb8ee75fd2	parth_valves	2026-04-21 04:07:59.188693+00	2026-04-21 04:07:59.188693+00	101	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b3b22112-7916-4e09-8e03-a17e47300a19	parth_valves	2026-04-21 04:07:59.188693+00	2026-04-21 04:07:59.188694+00	102	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4fdfbe88-c661-4b76-80e6-9fd27a5498b9	parth_valves	2026-04-21 04:07:59.188694+00	2026-04-21 04:07:59.188694+00	103	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
859736f7-7cbf-4d7e-9684-621f655a4f07	parth_valves	2026-04-21 04:07:59.188695+00	2026-04-21 04:07:59.188695+00	104	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
18664d19-6e11-406d-804d-bce793c8e0ea	parth_valves	2026-04-21 04:07:59.188695+00	2026-04-21 04:07:59.188696+00	105	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6216add5-8b92-4b67-bd63-417d5723d9c3	parth_valves	2026-04-21 04:07:59.188696+00	2026-04-21 04:07:59.188696+00	106	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
53ae19d8-42b8-441c-86fe-f50bcbda6dad	parth_valves	2026-04-21 04:07:59.188697+00	2026-04-21 04:07:59.188697+00	107	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
7e85b6e5-fee3-4627-a1b4-f534fd618876	parth_valves	2026-04-21 04:07:59.188698+00	2026-04-21 04:07:59.188698+00	108	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
59bdb61a-e384-4b74-bb08-ef7aff2a6c55	parth_valves	2026-04-21 04:07:59.188698+00	2026-04-21 04:07:59.188699+00	109	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5a48843c-43c5-4cbb-8407-f46f5e52e56e	parth_valves	2026-04-21 04:07:59.188699+00	2026-04-21 04:07:59.188699+00	110	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
d1cfd293-ca9a-49bb-bb07-bf8e8e0d9978	parth_valves	2026-04-21 04:07:59.1887+00	2026-04-21 04:07:59.1887+00	111	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b1256c2e-2e1f-455f-b786-8756c6766da4	parth_valves	2026-04-21 04:07:59.1887+00	2026-04-21 04:07:59.188701+00	112	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
2b8b223c-a4c7-417c-942f-5e0dc9c61242	parth_valves	2026-04-21 04:07:59.188701+00	2026-04-21 04:07:59.188702+00	113	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
47aae8ef-ac74-41e2-9948-05174c15fa00	parth_valves	2026-04-21 04:07:59.188702+00	2026-04-21 04:07:59.188702+00	114	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
956497f4-1ee6-4b6d-8932-b1e2df6aa70f	parth_valves	2026-04-21 04:07:59.188703+00	2026-04-21 04:07:59.188703+00	115	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
995357a9-404e-498d-a309-9252eb69bd43	parth_valves	2026-04-21 04:07:59.188703+00	2026-04-21 04:07:59.188704+00	116	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4d676940-4c02-4f3e-b964-a7272108beee	parth_valves	2026-04-21 04:07:59.188704+00	2026-04-21 04:07:59.188704+00	117	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0a4d7d31-461d-450e-8b0a-c808498a3861	parth_valves	2026-04-21 04:07:59.188705+00	2026-04-21 04:07:59.188705+00	118	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
1eeda2dd-fd1a-4b20-b7af-4b68ed98da10	parth_valves	2026-04-21 04:07:59.188705+00	2026-04-21 04:07:59.188706+00	119	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ff396a0a-1448-4fe1-b5bb-830cdd1dd82a	parth_valves	2026-04-21 04:07:59.188706+00	2026-04-21 04:07:59.188706+00	120	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4da79941-9759-4394-bd18-59a05c3e4fb3	parth_valves	2026-04-21 04:07:59.188707+00	2026-04-21 04:07:59.188707+00	121	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4537a2e0-ebd0-4565-acce-b693525cdfad	parth_valves	2026-04-21 04:07:59.188708+00	2026-04-21 04:07:59.188708+00	122	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5d2416e9-cb40-4098-b052-12fc39acb676	parth_valves	2026-04-21 04:07:59.188708+00	2026-04-21 04:07:59.188709+00	123	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
748e2769-2018-4366-b464-7a5dedd45e77	parth_valves	2026-04-21 04:07:59.188709+00	2026-04-21 04:07:59.188709+00	124	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c4cbc751-ea9b-440f-9d5c-18da73709041	parth_valves	2026-04-21 04:07:59.18871+00	2026-04-21 04:07:59.18871+00	125	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e9d4b4d3-b00d-47e4-9bf3-d8b07056cab2	parth_valves	2026-04-21 04:07:59.18871+00	2026-04-21 04:07:59.188711+00	126	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c6d54852-4fb7-43e4-aa6b-5e72647e4d69	parth_valves	2026-04-21 04:07:59.188711+00	2026-04-21 04:07:59.188711+00	127	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5e2276b9-47ec-493d-be51-f17d38001800	parth_valves	2026-04-21 04:07:59.188712+00	2026-04-21 04:07:59.188712+00	128	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
40d9637f-28bd-4763-9aec-8493016f2636	parth_valves	2026-04-21 04:07:59.188712+00	2026-04-21 04:07:59.188713+00	129	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e6ef77c3-b695-4a03-bc1a-5d1985a8ab9f	parth_valves	2026-04-21 04:07:59.188713+00	2026-04-21 04:07:59.188713+00	130	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
38311d8d-8740-46a8-8962-e720f231cda6	parth_valves	2026-04-21 04:07:59.188714+00	2026-04-21 04:07:59.188714+00	131	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
51d2ee52-b93a-4075-8ef4-4ee0e28687fc	parth_valves	2026-04-21 04:07:59.188714+00	2026-04-21 04:07:59.188715+00	132	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CI	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
1cc43092-d486-4e5c-a7d7-3c9355b382aa	parth_valves	2026-04-21 04:07:59.188715+00	2026-04-21 04:07:59.188715+00	133	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CI	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a6f6d8b5-3048-4d8e-9cc4-f17ff80e5073	parth_valves	2026-04-21 04:07:59.188716+00	2026-04-21 04:07:59.188716+00	134	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CI	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a3acd6f4-a64d-4510-8bbe-d527023f1279	parth_valves	2026-04-21 04:07:59.188717+00	2026-04-21 04:07:59.188717+00	135	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CI	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
1eaac1aa-0b80-4bd3-82b6-2685f03a4443	parth_valves	2026-04-21 04:07:59.188717+00	2026-04-21 04:07:59.188718+00	136	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
353973ab-e369-4a09-988d-36db3e814fc1	parth_valves	2026-04-21 04:07:59.188718+00	2026-04-21 04:07:59.188718+00	137	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c49bd627-1233-4b65-b2eb-e3a38c3de2db	parth_valves	2026-04-21 04:07:59.188719+00	2026-04-21 04:07:59.188719+00	138	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
788e58b3-949c-4c17-aada-ae7f694aa70a	parth_valves	2026-04-21 04:07:59.188719+00	2026-04-21 04:07:59.18872+00	139	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
03fcac12-3663-4c2c-9205-ac1880527eb6	parth_valves	2026-04-21 04:07:59.18872+00	2026-04-21 04:07:59.188721+00	140	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
673a59aa-648f-4f84-9678-b10a5a92039a	parth_valves	2026-04-21 04:07:59.188721+00	2026-04-21 04:07:59.188721+00	141	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5fa99063-5288-4b25-a59a-36ff92a147e0	parth_valves	2026-04-21 04:07:59.188722+00	2026-04-21 04:07:59.188722+00	142	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ba53f029-dc8b-4341-b03d-194187e022e2	parth_valves	2026-04-21 04:07:59.188722+00	2026-04-21 04:07:59.188723+00	143	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
af993351-d6ec-4675-baed-c547a0a0f373	parth_valves	2026-04-21 04:07:59.188723+00	2026-04-21 04:07:59.188723+00	144	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
69b112bd-68df-48bd-83bf-05437dcb8b0c	parth_valves	2026-04-21 04:07:59.188724+00	2026-04-21 04:07:59.188724+00	145	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0a230938-bb26-49d8-8753-2ef3ddf90a76	parth_valves	2026-04-21 04:07:59.188725+00	2026-04-21 04:07:59.188725+00	146	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ef5fabea-1083-4263-a18e-13bb9242b5f6	parth_valves	2026-04-21 04:07:59.188725+00	2026-04-21 04:07:59.188726+00	147	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b9e1bc8b-0176-4312-a207-c583fb68b172	parth_valves	2026-04-21 04:07:59.188726+00	2026-04-21 04:07:59.188726+00	148	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
50505066-2be7-4feb-a7cd-7246d1cc0346	parth_valves	2026-04-21 04:07:59.188727+00	2026-04-21 04:07:59.188727+00	149	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c39d2eb7-457d-4de6-b147-bd4e4fffcd51	parth_valves	2026-04-21 04:07:59.188728+00	2026-04-21 04:07:59.188728+00	150	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
602ce95c-5652-4c07-9940-84bf66357111	parth_valves	2026-04-21 04:07:59.188728+00	2026-04-21 04:07:59.188729+00	151	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f7e9f3ab-60a6-4675-8285-21c4e1c8f931	parth_valves	2026-04-21 04:07:59.188729+00	2026-04-21 04:07:59.18873+00	152	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b13e0b60-b222-4952-91ff-06146173cf3a	parth_valves	2026-04-21 04:07:59.18873+00	2026-04-21 04:07:59.18873+00	153	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
1178c8ed-f0a6-4b86-bfa6-1aa098ec756a	parth_valves	2026-04-21 04:07:59.188731+00	2026-04-21 04:07:59.188731+00	154	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0b9c172c-abe6-47c1-8b18-fd71bc3b33dc	parth_valves	2026-04-21 04:07:59.188731+00	2026-04-21 04:07:59.188732+00	155	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
df119b5d-9a23-4138-91ab-94db4ab72d41	parth_valves	2026-04-21 04:07:59.188732+00	2026-04-21 04:07:59.188733+00	156	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
68e8a0b5-b5a4-4a3f-a743-e7aefb6784a8	parth_valves	2026-04-21 04:07:59.188733+00	2026-04-21 04:07:59.188733+00	157	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
93c720ee-1744-47d9-a840-d9b3c3f922d6	parth_valves	2026-04-21 04:07:59.188734+00	2026-04-21 04:07:59.188734+00	158	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8b7d40ff-1117-4baf-bc0e-38555d800214	parth_valves	2026-04-21 04:07:59.188734+00	2026-04-21 04:07:59.188735+00	159	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8dcb0a8c-e2ec-46dc-9881-dc7e4f062ac2	parth_valves	2026-04-21 04:07:59.188735+00	2026-04-21 04:07:59.188735+00	160	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
37af9433-7dbd-4dfe-a96b-1f4c242a3cff	parth_valves	2026-04-21 04:07:59.188736+00	2026-04-21 04:07:59.188736+00	161	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
9c1cabd7-84e6-41af-b413-feb745692030	parth_valves	2026-04-21 04:07:59.188736+00	2026-04-21 04:07:59.188737+00	162	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
fb4edf14-182c-4f48-9f23-5f8785eb1fc4	parth_valves	2026-04-21 04:07:59.188737+00	2026-04-21 04:07:59.188737+00	163	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8f4e6f1f-f9cd-4545-a748-1ce437f0f5b8	parth_valves	2026-04-21 04:07:59.188738+00	2026-04-21 04:07:59.188738+00	164	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
17f7f4bb-9dd5-45c5-970a-c9d5cb067029	parth_valves	2026-04-21 04:07:59.188738+00	2026-04-21 04:07:59.188739+00	165	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
279eab87-10a8-4038-98bc-b45e1a96a447	parth_valves	2026-04-21 04:07:59.188739+00	2026-04-21 04:07:59.188739+00	166	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
24f8e196-24a8-4f7a-ac1d-aca12af7f5f5	parth_valves	2026-04-21 04:07:59.18874+00	2026-04-21 04:07:59.18874+00	167	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ceed344f-4a5b-48c0-9293-aaf19a240e5a	parth_valves	2026-04-21 04:07:59.18874+00	2026-04-21 04:07:59.188741+00	168	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
283ed00f-fb18-421b-9647-b1b7c20015f9	parth_valves	2026-04-21 04:07:59.188741+00	2026-04-21 04:07:59.188741+00	169	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
31d2b248-4056-4c6f-9ebf-faca2177faf0	parth_valves	2026-04-21 04:07:59.188742+00	2026-04-21 04:07:59.188742+00	170	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
eaa4756f-9d78-4134-8fec-804b1761b9a7	parth_valves	2026-04-21 04:07:59.188742+00	2026-04-21 04:07:59.188743+00	171	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
7c138067-0102-44bb-abe2-e52d82129c4a	parth_valves	2026-04-21 04:07:59.188743+00	2026-04-21 04:07:59.188743+00	172	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
174b7a1c-fbc4-45cb-a4e4-2eb88d18f192	parth_valves	2026-04-21 04:07:59.188744+00	2026-04-21 04:07:59.188744+00	173	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c38f722b-2e65-4126-971b-a5dc59c72259	parth_valves	2026-04-21 04:07:59.188744+00	2026-04-21 04:07:59.188745+00	174	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c47ee235-d212-4846-b267-04b3074d71b8	parth_valves	2026-04-21 04:07:59.188745+00	2026-04-21 04:07:59.188745+00	175	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
18be7d14-99f6-4c0d-9b4b-668baca99e4c	parth_valves	2026-04-21 04:07:59.188746+00	2026-04-21 04:07:59.188746+00	176	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6cfdcbe2-6e80-4ad8-ab1e-de6d535ad1d3	parth_valves	2026-04-21 04:07:59.188746+00	2026-04-21 04:07:59.188747+00	177	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
fe740dc2-10d4-4866-8076-44ae9e810fcb	parth_valves	2026-04-21 04:07:59.188747+00	2026-04-21 04:07:59.188747+00	178	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4adfce5a-1bd3-4d36-9c1d-d8b1777ad13b	parth_valves	2026-04-21 04:07:59.188748+00	2026-04-21 04:07:59.188748+00	179	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
2e3a8fa7-5702-4a16-9267-b5e9354d7381	parth_valves	2026-04-21 04:07:59.188748+00	2026-04-21 04:07:59.188749+00	180	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
2b66c6aa-c008-4524-a17d-b1c878310038	parth_valves	2026-04-21 04:07:59.188749+00	2026-04-21 04:07:59.188749+00	181	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8567bd71-b5fa-4a03-a68b-2c75c65a43e7	parth_valves	2026-04-21 04:07:59.18875+00	2026-04-21 04:07:59.18875+00	182	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0c76c40c-b36a-4530-930d-02eb93faf96b	parth_valves	2026-04-21 04:07:59.18875+00	2026-04-21 04:07:59.188751+00	183	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c9fb034a-6d1a-409f-aef5-6805609b3b74	parth_valves	2026-04-21 04:07:59.188751+00	2026-04-21 04:07:59.188751+00	184	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
913a7f42-7bfe-4ae1-99a2-dcb13fbfac7c	parth_valves	2026-04-21 04:07:59.188752+00	2026-04-21 04:07:59.188752+00	185	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
26ebea45-47d7-45b5-b8da-4eb1b4a51e20	parth_valves	2026-04-21 04:07:59.188752+00	2026-04-21 04:07:59.188753+00	186	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
67574a74-f80e-41f0-9c2a-87c70cc4405f	parth_valves	2026-04-21 04:07:59.188753+00	2026-04-21 04:07:59.188753+00	187	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
96ff8066-12e0-4726-83c8-26070e96122c	parth_valves	2026-04-21 04:07:59.188754+00	2026-04-21 04:07:59.188754+00	188	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
7af3aa30-4f7a-4a23-93a3-7462e3566c81	parth_valves	2026-04-21 04:07:59.188754+00	2026-04-21 04:07:59.188755+00	189	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a7af4b0f-c798-4fb0-8a46-8e177c53b737	parth_valves	2026-04-21 04:07:59.188755+00	2026-04-21 04:07:59.188755+00	190	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8e929a2e-5ffe-435f-b7dd-cd57506bbf27	parth_valves	2026-04-21 04:07:59.188756+00	2026-04-21 04:07:59.188756+00	191	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
56bcbb55-c43c-4c68-9e5f-7e92449b5efa	parth_valves	2026-04-21 04:07:59.188757+00	2026-04-21 04:07:59.188757+00	192	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
1a27257b-f0ab-4fb2-a7d2-c1b77efa91f6	parth_valves	2026-04-21 04:07:59.188757+00	2026-04-21 04:07:59.188758+00	193	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a284e777-fa6e-4744-a8eb-6d57b49a6c58	parth_valves	2026-04-21 04:07:59.188758+00	2026-04-21 04:07:59.188758+00	194	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f96cd4a6-a556-4581-8c07-c43dc82edbb2	parth_valves	2026-04-21 04:07:59.188759+00	2026-04-21 04:07:59.188759+00	195	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
de4e0fe0-ee97-4f7f-8bf8-561b3697a973	parth_valves	2026-04-21 04:07:59.188759+00	2026-04-21 04:07:59.18876+00	196	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	WCB	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
01c11db0-bd92-4936-b2be-6c85d28e913d	parth_valves	2026-04-21 04:07:59.18876+00	2026-04-21 04:07:59.18876+00	197	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	WCB	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
473f4202-bbe3-48f2-9a44-a4ffc136aaee	parth_valves	2026-04-21 04:07:59.188761+00	2026-04-21 04:07:59.188761+00	198	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	WCB	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
00d8d799-33ce-489f-b7ce-3e4c3e206976	parth_valves	2026-04-21 04:07:59.188761+00	2026-04-21 04:07:59.188762+00	199	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	WCB	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c8984d2d-9467-4721-89d8-493ecfb46bf0	parth_valves	2026-04-21 04:07:59.188762+00	2026-04-21 04:07:59.188762+00	200	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ad74b152-e36a-41a7-8ba4-5c4969fc2bea	parth_valves	2026-04-21 04:07:59.188763+00	2026-04-21 04:07:59.188763+00	201	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f637c0eb-6dd4-40a5-95e4-e98d911885dc	parth_valves	2026-04-21 04:07:59.188763+00	2026-04-21 04:07:59.188764+00	202	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a3f08954-cf5f-43d9-9755-90103f83902b	parth_valves	2026-04-21 04:07:59.188764+00	2026-04-21 04:07:59.188764+00	203	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
13df5932-4591-4912-8ec9-31bbc3f758db	parth_valves	2026-04-21 04:07:59.188765+00	2026-04-21 04:07:59.188765+00	204	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
46b47c3e-c836-499c-b109-9fa2a11e4b74	parth_valves	2026-04-21 04:07:59.188766+00	2026-04-21 04:07:59.188766+00	205	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
bee9221d-15a0-4f51-a1e5-8a2d2f49a931	parth_valves	2026-04-21 04:07:59.188766+00	2026-04-21 04:07:59.188766+00	206	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
2bdc9203-4792-413a-84e2-2b39fe8d6a36	parth_valves	2026-04-21 04:07:59.188767+00	2026-04-21 04:07:59.188767+00	207	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5e633333-6323-409d-aa71-1468b78b5080	parth_valves	2026-04-21 04:07:59.188768+00	2026-04-21 04:07:59.188768+00	208	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6ba7f0b9-2573-4ccb-85cf-d6108eedde85	parth_valves	2026-04-21 04:07:59.188768+00	2026-04-21 04:07:59.188769+00	209	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
77dfc5de-6359-4f90-9048-0b6e80a6835b	parth_valves	2026-04-21 04:07:59.188769+00	2026-04-21 04:07:59.188769+00	210	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c65ad663-159e-41ac-afc3-7199b9e1984e	parth_valves	2026-04-21 04:07:59.18877+00	2026-04-21 04:07:59.18877+00	211	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
eb2c49dd-ad7a-49dc-851f-79e742c374bc	parth_valves	2026-04-21 04:07:59.18877+00	2026-04-21 04:07:59.188771+00	212	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0e305ad6-29fa-4005-bbd4-a814849b04b7	parth_valves	2026-04-21 04:07:59.188771+00	2026-04-21 04:07:59.188771+00	213	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
439c1798-4cca-4a6e-b648-7c783573439c	parth_valves	2026-04-21 04:07:59.188772+00	2026-04-21 04:07:59.188772+00	214	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f208ed32-6d59-465e-88d6-a6210fdba6ec	parth_valves	2026-04-21 04:07:59.188772+00	2026-04-21 04:07:59.188773+00	215	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
55e77811-2753-489d-96b5-aaa37579cc47	parth_valves	2026-04-21 04:07:59.188773+00	2026-04-21 04:07:59.188773+00	216	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
fc2e8dad-00d0-4fb6-bd39-1182bd24c462	parth_valves	2026-04-21 04:07:59.188774+00	2026-04-21 04:07:59.188774+00	217	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6110ceb1-aff5-4ab3-ad1c-684ecdaa49e5	parth_valves	2026-04-21 04:07:59.188774+00	2026-04-21 04:07:59.188775+00	218	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
7586c62d-d516-4274-8170-91b672fdb972	parth_valves	2026-04-21 04:07:59.188775+00	2026-04-21 04:07:59.188775+00	219	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
bd2544e4-cfc8-4723-866a-816f604328f9	parth_valves	2026-04-21 04:07:59.188776+00	2026-04-21 04:07:59.188776+00	220	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
77e04eca-c4e5-4db8-8e6b-c0e6134263df	parth_valves	2026-04-21 04:07:59.188776+00	2026-04-21 04:07:59.188777+00	221	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
92ac9a7b-d35f-45c7-8f54-d3372a5be2f6	parth_valves	2026-04-21 04:07:59.188777+00	2026-04-21 04:07:59.188777+00	222	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
506c2f98-d221-4824-b608-d7b8ff330704	parth_valves	2026-04-21 04:07:59.188778+00	2026-04-21 04:07:59.188778+00	223	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
92106ff4-0d41-4a02-88ea-f818179b3ed6	parth_valves	2026-04-21 04:07:59.188778+00	2026-04-21 04:07:59.188779+00	224	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b25cf61d-004b-4d13-98f7-159bda5c11c4	parth_valves	2026-04-21 04:07:59.188779+00	2026-04-21 04:07:59.188779+00	225	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6affd9bc-bbd0-4977-9d8a-b87b004e7f5a	parth_valves	2026-04-21 04:07:59.18878+00	2026-04-21 04:07:59.18878+00	226	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b35001f1-d7f8-4482-8853-26a25c28db60	parth_valves	2026-04-21 04:07:59.18878+00	2026-04-21 04:07:59.188781+00	227	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e26b2554-0c2a-4499-a510-21dd3164bde3	parth_valves	2026-04-21 04:07:59.188781+00	2026-04-21 04:07:59.188781+00	228	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
42b21c23-1105-432a-877e-5e5843bcfc11	parth_valves	2026-04-21 04:07:59.188782+00	2026-04-21 04:07:59.188782+00	229	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
802becfe-a752-47a9-84a4-4566dc9c87b8	parth_valves	2026-04-21 04:07:59.188782+00	2026-04-21 04:07:59.188783+00	230	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
aa3ed92c-c1cc-43e7-a60a-bc22c4a907c6	parth_valves	2026-04-21 04:07:59.188783+00	2026-04-21 04:07:59.188783+00	231	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
aad8e541-5ce9-40c6-b48c-67fbcd91f278	parth_valves	2026-04-21 04:07:59.188784+00	2026-04-21 04:07:59.188784+00	232	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8e62c25d-bac6-45b1-91ad-ca555365c083	parth_valves	2026-04-21 04:07:59.188784+00	2026-04-21 04:07:59.188785+00	233	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b2520242-ca2e-4e9c-83ee-c8eedbe370cc	parth_valves	2026-04-21 04:07:59.188785+00	2026-04-21 04:07:59.188786+00	234	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
9b62ced2-fe3e-4449-9094-f452fc81ce7a	parth_valves	2026-04-21 04:07:59.188786+00	2026-04-21 04:07:59.188786+00	235	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
d73ef1a0-2079-4cbc-b659-8a12a51d3af6	parth_valves	2026-04-21 04:07:59.188787+00	2026-04-21 04:07:59.188787+00	236	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e2141dfe-4663-47b0-8957-69900a6981fd	parth_valves	2026-04-21 04:07:59.188787+00	2026-04-21 04:07:59.188788+00	237	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
57f56985-b103-4eed-99f2-071adf7e7cd7	parth_valves	2026-04-21 04:07:59.188788+00	2026-04-21 04:07:59.188788+00	238	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ff09bce7-a103-4954-b67c-b1a5f182947a	parth_valves	2026-04-21 04:07:59.188789+00	2026-04-21 04:07:59.188789+00	239	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b901bcfd-3d73-4fbf-b397-5ae817a7f79b	parth_valves	2026-04-21 04:07:59.188789+00	2026-04-21 04:07:59.18879+00	240	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
77df379d-6f92-45ee-b6ca-bd8ed68308e5	parth_valves	2026-04-21 04:07:59.18879+00	2026-04-21 04:07:59.18879+00	241	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a613c4c9-1892-45bc-befe-f8b88a8669c2	parth_valves	2026-04-21 04:07:59.188791+00	2026-04-21 04:07:59.188791+00	242	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
743a940f-b98b-4426-b889-f1069a6c9df2	parth_valves	2026-04-21 04:07:59.188791+00	2026-04-21 04:07:59.188792+00	243	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
28ffc2b3-c486-434a-8ecf-9f30790a3b37	parth_valves	2026-04-21 04:07:59.188792+00	2026-04-21 04:07:59.188792+00	244	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c6245915-90a9-4cce-8587-d2359f0e04a6	parth_valves	2026-04-21 04:07:59.188793+00	2026-04-21 04:07:59.188793+00	245	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8e1bcec1-5f31-4e9b-a73c-d4e0f7db52f0	parth_valves	2026-04-21 04:07:59.188794+00	2026-04-21 04:07:59.188794+00	246	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
3f9327c6-8d31-4917-a35f-8aabf95afe2e	parth_valves	2026-04-21 04:07:59.188794+00	2026-04-21 04:07:59.188795+00	247	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8cbbe743-8759-48f4-8037-9a9bf4305837	parth_valves	2026-04-21 04:07:59.188795+00	2026-04-21 04:07:59.188795+00	248	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
20ce4f58-5050-429a-8b00-65c66e12fb91	parth_valves	2026-04-21 04:07:59.188796+00	2026-04-21 04:07:59.188796+00	249	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b99114c5-b84c-4629-89e3-27218b2d3238	parth_valves	2026-04-21 04:07:59.188796+00	2026-04-21 04:07:59.188797+00	250	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
d446ceb6-5ea3-40bb-aed4-424d842d9a47	parth_valves	2026-04-21 04:07:59.188797+00	2026-04-21 04:07:59.188797+00	251	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f5e7103a-ce21-4c40-a857-fff21633ebc7	parth_valves	2026-04-21 04:07:59.188798+00	2026-04-21 04:07:59.188798+00	252	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
22278f59-5ed9-4d27-a1cb-1c84f569e784	parth_valves	2026-04-21 04:07:59.188798+00	2026-04-21 04:07:59.188799+00	253	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
819d217f-7235-404b-92fb-cc6f7a36053e	parth_valves	2026-04-21 04:07:59.188799+00	2026-04-21 04:07:59.188799+00	254	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6a011493-fb9d-42f7-aff1-77408f25032c	parth_valves	2026-04-21 04:07:59.1888+00	2026-04-21 04:07:59.1888+00	255	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0377a676-cf23-4b38-99e7-9a9b61598c38	parth_valves	2026-04-21 04:07:59.1888+00	2026-04-21 04:07:59.188801+00	256	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e64d4396-fb22-490e-8906-a48fbc6cec0f	parth_valves	2026-04-21 04:07:59.188801+00	2026-04-21 04:07:59.188801+00	257	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e00606f8-10c2-4550-b27b-4b60f3f1514e	parth_valves	2026-04-21 04:07:59.188802+00	2026-04-21 04:07:59.188802+00	258	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
21d05478-bf55-4158-be5d-326ba2fd25ef	parth_valves	2026-04-21 04:07:59.188802+00	2026-04-21 04:07:59.188803+00	259	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e6389f35-b249-48ae-8824-ea0bbd85776b	parth_valves	2026-04-21 04:07:59.188803+00	2026-04-21 04:07:59.188803+00	260	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CF8	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
896c11cb-ddec-40fe-b569-009910332c63	parth_valves	2026-04-21 04:07:59.188804+00	2026-04-21 04:07:59.188804+00	261	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CF8	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
78f5b6a5-cbd8-4cf1-b452-de11057b6b37	parth_valves	2026-04-21 04:07:59.188804+00	2026-04-21 04:07:59.188805+00	262	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CF8	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4766fb5e-9a19-47b0-b22f-2b485ce4903f	parth_valves	2026-04-21 04:07:59.188805+00	2026-04-21 04:07:59.188805+00	263	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CF8	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e129a777-db3d-40f4-b060-b80df0a69b8b	parth_valves	2026-04-21 04:07:59.188806+00	2026-04-21 04:07:59.188806+00	264	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5d4934cc-a274-4f6e-9e3b-02588b76d82a	parth_valves	2026-04-21 04:07:59.188806+00	2026-04-21 04:07:59.188806+00	265	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
e69d00de-73b3-405a-8361-dea5f63dedc3	parth_valves	2026-04-21 04:07:59.188807+00	2026-04-21 04:07:59.188807+00	266	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
740b02c0-9d24-4a8f-8bc7-1ee2722ffbd2	parth_valves	2026-04-21 04:07:59.188808+00	2026-04-21 04:07:59.188808+00	267	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
55c1ade6-ef8a-42e0-8b52-293dbbdeee53	parth_valves	2026-04-21 04:07:59.188808+00	2026-04-21 04:07:59.188808+00	268	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
943e7129-f277-405f-b7fe-de4d9b08d356	parth_valves	2026-04-21 04:07:59.188809+00	2026-04-21 04:07:59.188809+00	269	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
fa72c98d-8183-45ff-9525-0bbc6e0d6c70	parth_valves	2026-04-21 04:07:59.18881+00	2026-04-21 04:07:59.18881+00	270	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
9c39be74-8ec5-4d8c-9121-0eff4cbdbd7f	parth_valves	2026-04-21 04:07:59.18881+00	2026-04-21 04:07:59.18881+00	271	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4266711f-7e93-410a-8d67-712c7276c4b8	parth_valves	2026-04-21 04:07:59.188811+00	2026-04-21 04:07:59.188811+00	272	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f9116837-0921-4ec8-98ce-8efc525caf49	parth_valves	2026-04-21 04:07:59.188812+00	2026-04-21 04:07:59.188812+00	273	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
9912aea8-82fb-4a14-b703-c2ce01ae5f83	parth_valves	2026-04-21 04:07:59.188812+00	2026-04-21 04:07:59.188812+00	274	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
40bf6b23-edb3-4e89-8b51-420d327a660c	parth_valves	2026-04-21 04:07:59.188813+00	2026-04-21 04:07:59.188813+00	275	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a2a4128b-6ea7-4f52-887b-9a0a55e9411b	parth_valves	2026-04-21 04:07:59.188813+00	2026-04-21 04:07:59.188814+00	276	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a7a00f7e-6d48-4e75-8d6c-af07711cb505	parth_valves	2026-04-21 04:07:59.188814+00	2026-04-21 04:07:59.188814+00	277	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
01735b29-2faa-453b-85bb-e537fe57170f	parth_valves	2026-04-21 04:07:59.188815+00	2026-04-21 04:07:59.188815+00	278	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0c0806b8-4669-4325-96a9-471d71e5f249	parth_valves	2026-04-21 04:07:59.188815+00	2026-04-21 04:07:59.188816+00	279	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b09df386-1dac-4f3e-8f59-748edac58cf6	parth_valves	2026-04-21 04:07:59.188816+00	2026-04-21 04:07:59.188816+00	280	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
093af7f9-174e-4fc1-b62b-6a8ea4f6b7af	parth_valves	2026-04-21 04:07:59.188817+00	2026-04-21 04:07:59.188817+00	281	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
cad37439-c0d1-4611-b019-b0717b86ee10	parth_valves	2026-04-21 04:07:59.188817+00	2026-04-21 04:07:59.188818+00	282	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
612717fe-0a13-484e-aac6-e5fcbba5e7aa	parth_valves	2026-04-21 04:07:59.188818+00	2026-04-21 04:07:59.188818+00	283	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
59b1d3e1-33d1-48cc-ab57-dd87cb20812f	parth_valves	2026-04-21 04:07:59.188819+00	2026-04-21 04:07:59.188819+00	284	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
70a984dd-f3ab-4f03-b168-91516ddacd3e	parth_valves	2026-04-21 04:07:59.188819+00	2026-04-21 04:07:59.18882+00	285	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
334c838b-a10b-4ebe-8d53-02b2a7f82ee7	parth_valves	2026-04-21 04:07:59.18882+00	2026-04-21 04:07:59.18882+00	286	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
efb6c5f8-d927-470a-b4e2-eb3999a8d484	parth_valves	2026-04-21 04:07:59.188821+00	2026-04-21 04:07:59.188821+00	287	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
788a7524-98fd-4bb8-942b-526de9644c54	parth_valves	2026-04-21 04:07:59.188821+00	2026-04-21 04:07:59.188822+00	288	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b718eb0f-0a13-445e-958a-138356cc07ef	parth_valves	2026-04-21 04:07:59.188822+00	2026-04-21 04:07:59.188822+00	289	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
95c5e4e7-ac26-4f98-aa30-0912088786c7	parth_valves	2026-04-21 04:07:59.188823+00	2026-04-21 04:07:59.188823+00	290	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6c80468d-986d-4458-894a-d79c0ec149d7	parth_valves	2026-04-21 04:07:59.188823+00	2026-04-21 04:07:59.188824+00	291	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
108560bc-f97f-4b02-a645-b886f610bc59	parth_valves	2026-04-21 04:07:59.188824+00	2026-04-21 04:07:59.188824+00	292	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
58ebbb67-dedb-4700-a58b-61aca4e3f5b2	parth_valves	2026-04-21 04:07:59.188825+00	2026-04-21 04:07:59.188825+00	293	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
494778d9-960b-47a4-a968-1516bf9f2743	parth_valves	2026-04-21 04:07:59.188825+00	2026-04-21 04:07:59.188826+00	294	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ff0e6de6-053f-4093-b645-4af55cf54dd9	parth_valves	2026-04-21 04:07:59.188826+00	2026-04-21 04:07:59.188826+00	295	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
1117ebaa-e47d-40db-ae28-794b4aa327b4	parth_valves	2026-04-21 04:07:59.188827+00	2026-04-21 04:07:59.188827+00	296	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
cc54dad8-8127-4bd2-a847-8fb32f398669	parth_valves	2026-04-21 04:07:59.188827+00	2026-04-21 04:07:59.188828+00	297	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
9330ea7d-dc79-43fa-8f30-17d380c1db45	parth_valves	2026-04-21 04:07:59.188828+00	2026-04-21 04:07:59.188828+00	298	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4730bab1-603f-43aa-8b8d-56b865d98173	parth_valves	2026-04-21 04:07:59.188829+00	2026-04-21 04:07:59.188829+00	299	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0e3fc866-4894-4985-b1a2-5b4f67417dc9	parth_valves	2026-04-21 04:07:59.188829+00	2026-04-21 04:07:59.18883+00	300	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
76588edd-afb6-4df1-bf1a-dba3c6d0a4b1	parth_valves	2026-04-21 04:07:59.18883+00	2026-04-21 04:07:59.18883+00	301	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8b254d2c-a788-42f1-9ed7-70e5f799f280	parth_valves	2026-04-21 04:07:59.188831+00	2026-04-21 04:07:59.188831+00	302	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
f73ecb79-9dbc-4c93-afc8-e87c92520a0c	parth_valves	2026-04-21 04:07:59.188831+00	2026-04-21 04:07:59.188832+00	303	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
9b751e1d-e5d3-4ec1-b637-719851abc809	parth_valves	2026-04-21 04:07:59.188832+00	2026-04-21 04:07:59.188832+00	304	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
24478c82-2d1a-4931-8b4d-057d195d0c4c	parth_valves	2026-04-21 04:07:59.188833+00	2026-04-21 04:07:59.188833+00	305	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
7ac3b80a-1105-4aad-8e0b-8e7252173b85	parth_valves	2026-04-21 04:07:59.188833+00	2026-04-21 04:07:59.188834+00	306	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
89c655c8-d5d2-4c05-9843-6bf30f57a246	parth_valves	2026-04-21 04:07:59.188834+00	2026-04-21 04:07:59.188834+00	307	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
088c7119-3194-4e8b-b3fb-9cf2fe39e3a9	parth_valves	2026-04-21 04:07:59.188835+00	2026-04-21 04:07:59.188835+00	308	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
2bf38f35-30ce-4637-8887-fcb97a1e71e6	parth_valves	2026-04-21 04:07:59.188835+00	2026-04-21 04:07:59.188836+00	309	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
34fe25d7-c51f-497f-865b-a513c346e62c	parth_valves	2026-04-21 04:07:59.188836+00	2026-04-21 04:07:59.188836+00	310	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
ad117651-d8ea-40b3-b99c-34a8c7acb826	parth_valves	2026-04-21 04:07:59.188837+00	2026-04-21 04:07:59.188837+00	311	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
1a9f96d9-26ca-444d-aae4-439855ddfaee	parth_valves	2026-04-21 04:07:59.188837+00	2026-04-21 04:07:59.188838+00	312	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
94543504-11c9-4596-9d4e-c2db1d9315a1	parth_valves	2026-04-21 04:07:59.188838+00	2026-04-21 04:07:59.188838+00	313	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
b2e12544-c064-4d43-9e11-a943024d8eca	parth_valves	2026-04-21 04:07:59.188839+00	2026-04-21 04:07:59.188839+00	314	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
4cf46ac8-bc7d-4704-b853-cc7f69fd5213	parth_valves	2026-04-21 04:07:59.188839+00	2026-04-21 04:07:59.18884+00	315	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
8de8356a-e2fa-4f4c-be66-e570644e2fc5	parth_valves	2026-04-21 04:07:59.18884+00	2026-04-21 04:07:59.18884+00	316	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6d359965-681d-48f2-8343-efac660711a3	parth_valves	2026-04-21 04:07:59.188841+00	2026-04-21 04:07:59.188841+00	317	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
065fd527-7100-438a-b2c2-5addd92434ab	parth_valves	2026-04-21 04:07:59.188841+00	2026-04-21 04:07:59.188842+00	318	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
cdff22d3-6708-40e2-b1d8-39b254a8744d	parth_valves	2026-04-21 04:07:59.188842+00	2026-04-21 04:07:59.188842+00	319	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
a971c793-925e-4b4b-92bc-be2b9d8319bb	parth_valves	2026-04-21 04:07:59.188843+00	2026-04-21 04:07:59.188843+00	320	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5fff2610-92f6-4ced-887f-4ae1fa7a15e2	parth_valves	2026-04-21 04:07:59.188843+00	2026-04-21 04:07:59.188844+00	321	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
eaaea338-02c0-4007-a889-dc54112bacc6	parth_valves	2026-04-21 04:07:59.188844+00	2026-04-21 04:07:59.188844+00	322	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
78299929-5cd8-4644-85fc-3f4e370502df	parth_valves	2026-04-21 04:07:59.188845+00	2026-04-21 04:07:59.188845+00	323	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
6e6bb98e-f92d-472c-84ef-94d51d0c939c	parth_valves	2026-04-21 04:07:59.188845+00	2026-04-21 04:07:59.188846+00	324	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CF8M	SGI	SS410	EPDM	MS	\N	Files 20-29 (PN10)
48f3d0c2-2e3c-469d-95c9-b4ac09cb2e57	parth_valves	2026-04-21 04:07:59.188846+00	2026-04-21 04:07:59.188846+00	325	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CF8M	WCB	SS410	EPDM	MS	\N	Files 20-29 (PN10)
c53ec507-186e-4f93-af6a-fc0333e73a24	parth_valves	2026-04-21 04:07:59.188847+00	2026-04-21 04:07:59.188847+00	326	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CF8M	CF8	SS410	EPDM	MS	\N	Files 20-29 (PN10)
5858ccd1-5008-49bd-a456-a6044a840880	parth_valves	2026-04-21 04:07:59.188847+00	2026-04-21 04:07:59.188848+00	327	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN10	CF8M	CF8M	SS410	EPDM	MS	\N	Files 20-29 (PN10)
0d300fc3-627e-4a90-ae26-f62a0f028940	parth_valves	2026-04-21 04:07:59.188848+00	2026-04-21 04:07:59.188848+00	328	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
41766049-d7d9-412a-86db-6712dd01b9fc	parth_valves	2026-04-21 04:07:59.188849+00	2026-04-21 04:07:59.188849+00	329	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2ac5ba3a-9d38-4705-bef1-34b0eb7842f9	parth_valves	2026-04-21 04:07:59.188849+00	2026-04-21 04:07:59.18885+00	330	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c9b3a3c9-1e42-4d2c-aeb1-333a9981ad10	parth_valves	2026-04-21 04:07:59.18885+00	2026-04-21 04:07:59.18885+00	331	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4efe8069-dfc5-4541-a04b-6fddcf8c083e	parth_valves	2026-04-21 04:07:59.188851+00	2026-04-21 04:07:59.188851+00	332	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
facbcc60-c896-43a1-8924-ba49fdd8a865	parth_valves	2026-04-21 04:07:59.188851+00	2026-04-21 04:07:59.188852+00	333	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
d372dc59-af6f-43f5-aa99-7997967dc8ab	parth_valves	2026-04-21 04:07:59.188852+00	2026-04-21 04:07:59.188852+00	334	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
21558f17-d71b-4cc0-b677-4019fad22045	parth_valves	2026-04-21 04:07:59.188853+00	2026-04-21 04:07:59.188853+00	335	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
cba8f4ae-5d5d-4b7c-a6a3-4eb5a7915d54	parth_valves	2026-04-21 04:07:59.188853+00	2026-04-21 04:07:59.188853+00	336	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
379351d4-b3b7-4d0b-9b11-8bc58d815c2c	parth_valves	2026-04-21 04:07:59.188854+00	2026-04-21 04:07:59.188854+00	337	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
11f11c64-daa9-4ce3-a973-7d27f4ea2ec1	parth_valves	2026-04-21 04:07:59.188855+00	2026-04-21 04:07:59.188855+00	338	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
cf4e96bc-7b23-40fc-ac0b-017c99700ff1	parth_valves	2026-04-21 04:07:59.188855+00	2026-04-21 04:07:59.188855+00	339	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
42cd5b61-4989-4811-a65d-0f5eefa919f6	parth_valves	2026-04-21 04:07:59.188856+00	2026-04-21 04:07:59.188856+00	340	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2a5ad177-41e3-4ae1-932e-93d96baf5b80	parth_valves	2026-04-21 04:07:59.188856+00	2026-04-21 04:07:59.188857+00	341	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
275b79f5-8f1f-4507-8b4b-2f52c49f51d2	parth_valves	2026-04-21 04:07:59.188857+00	2026-04-21 04:07:59.188857+00	342	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
852ae5ea-1ed5-431e-97a8-9b461adc79b8	parth_valves	2026-04-21 04:07:59.188858+00	2026-04-21 04:07:59.188858+00	343	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0f6a70d0-353e-403f-a647-4d2b13592357	parth_valves	2026-04-21 04:07:59.188858+00	2026-04-21 04:07:59.188859+00	344	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e0bec4c6-ef51-44c6-9657-0aff391ce2ef	parth_valves	2026-04-21 04:07:59.188859+00	2026-04-21 04:07:59.188859+00	345	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
7d92dbf4-8571-484f-8216-53577eb2e987	parth_valves	2026-04-21 04:07:59.18886+00	2026-04-21 04:07:59.18886+00	346	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0dcd5e03-e499-4ecb-aa8d-f69da101fed7	parth_valves	2026-04-21 04:07:59.18886+00	2026-04-21 04:07:59.188861+00	347	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0b66cb99-3ed3-40d2-b7c8-87521ad30d71	parth_valves	2026-04-21 04:07:59.188861+00	2026-04-21 04:07:59.188861+00	348	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
d0917a23-5d08-46ed-acf0-bbd8c0e46cc6	parth_valves	2026-04-21 04:07:59.188862+00	2026-04-21 04:07:59.188862+00	349	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4c92624d-3a3e-46b9-992d-41fb1f42d0a6	parth_valves	2026-04-21 04:07:59.188862+00	2026-04-21 04:07:59.188863+00	350	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
7971a6da-4efd-43ca-9326-22ce9d5ee3c9	parth_valves	2026-04-21 04:07:59.188863+00	2026-04-21 04:07:59.188863+00	351	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
7cbeab54-9df8-4352-ab61-fc0187398049	parth_valves	2026-04-21 04:07:59.188864+00	2026-04-21 04:07:59.188864+00	352	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
70c99b5d-d678-4306-8af8-5fb1c4910ad5	parth_valves	2026-04-21 04:07:59.188864+00	2026-04-21 04:07:59.188865+00	353	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
dbf990c9-ac28-4e52-a081-e276a8ed2e3a	parth_valves	2026-04-21 04:07:59.188865+00	2026-04-21 04:07:59.188865+00	354	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
49329b59-d139-4410-876c-e6d8d9750c1b	parth_valves	2026-04-21 04:07:59.188866+00	2026-04-21 04:07:59.188866+00	355	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ec8d1f47-38ee-402d-a32a-782565b63f7f	parth_valves	2026-04-21 04:07:59.188866+00	2026-04-21 04:07:59.188867+00	356	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ee118920-b540-469d-bf60-51933f10ea5b	parth_valves	2026-04-21 04:07:59.188867+00	2026-04-21 04:07:59.188867+00	357	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2f0b0ed8-849f-40d4-9556-857b5ab6d19b	parth_valves	2026-04-21 04:07:59.188868+00	2026-04-21 04:07:59.188868+00	358	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0d983a79-cbb5-4383-8048-5bd165a36d4d	parth_valves	2026-04-21 04:07:59.188868+00	2026-04-21 04:07:59.188869+00	359	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
15884ee6-7849-4cf0-8e7f-6df95ee12d0c	parth_valves	2026-04-21 04:07:59.188869+00	2026-04-21 04:07:59.188869+00	360	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
d0a593ae-8560-4b88-9783-8b51ba3e38c0	parth_valves	2026-04-21 04:07:59.18887+00	2026-04-21 04:07:59.18887+00	361	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2a2239ef-6856-4c31-98f7-5e97b7a1b0ee	parth_valves	2026-04-21 04:07:59.18887+00	2026-04-21 04:07:59.188871+00	362	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
aab6c8ec-d6bb-42f7-ac16-de92a5ca9f58	parth_valves	2026-04-21 04:07:59.188871+00	2026-04-21 04:07:59.188871+00	363	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
72af8b0f-74b8-44c0-9a6e-1d710be5ee77	parth_valves	2026-04-21 04:07:59.188872+00	2026-04-21 04:07:59.188872+00	364	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c9f7d2be-838a-48b8-bdd3-2277aa215e6a	parth_valves	2026-04-21 04:07:59.188872+00	2026-04-21 04:07:59.188873+00	365	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
07d6c2bb-b26e-4111-91bf-20d6d9d6523d	parth_valves	2026-04-21 04:07:59.188873+00	2026-04-21 04:07:59.188873+00	366	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
50dc1a8e-e5a8-46b7-845e-318591aa8df7	parth_valves	2026-04-21 04:07:59.188874+00	2026-04-21 04:07:59.188874+00	367	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9b515f1b-6f54-4ad8-9ad7-48631a3e92c3	parth_valves	2026-04-21 04:07:59.188874+00	2026-04-21 04:07:59.188875+00	368	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
85202ede-d732-4f42-83c5-a51031666d9e	parth_valves	2026-04-21 04:07:59.188875+00	2026-04-21 04:07:59.188875+00	369	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
dceb94b2-fa7d-4c72-9277-fa71bdb8a455	parth_valves	2026-04-21 04:07:59.188876+00	2026-04-21 04:07:59.188876+00	370	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e1fd98b0-cf93-4b1b-a1f9-ed7d2053c0c9	parth_valves	2026-04-21 04:07:59.188876+00	2026-04-21 04:07:59.188877+00	371	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
cbc2eb78-dbf1-44c6-b95a-4ef07d6e1176	parth_valves	2026-04-21 04:07:59.188877+00	2026-04-21 04:07:59.188877+00	372	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
edb7b662-7a33-4c15-bd83-d8b8555421d9	parth_valves	2026-04-21 04:07:59.188878+00	2026-04-21 04:07:59.188878+00	373	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b2810f79-7a1f-42c5-8081-c56ad5d9dac2	parth_valves	2026-04-21 04:07:59.188878+00	2026-04-21 04:07:59.188879+00	374	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
8b0aa3cf-5192-408d-9483-d2f7382755cc	parth_valves	2026-04-21 04:07:59.188879+00	2026-04-21 04:07:59.188879+00	375	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
60a6deb9-3baf-45ed-ab42-31317a25484e	parth_valves	2026-04-21 04:07:59.18888+00	2026-04-21 04:07:59.18888+00	376	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
128d903e-3031-48e6-9245-4baa04850ada	parth_valves	2026-04-21 04:07:59.18888+00	2026-04-21 04:07:59.188881+00	377	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
423fc42d-cad6-4a7d-a937-46bfda49ebad	parth_valves	2026-04-21 04:07:59.188881+00	2026-04-21 04:07:59.188881+00	378	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c4b50f20-1d25-4a60-96a2-87be2e1610ee	parth_valves	2026-04-21 04:07:59.188882+00	2026-04-21 04:07:59.188882+00	379	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
70a9065b-88ba-4c27-a349-a5b79042987d	parth_valves	2026-04-21 04:07:59.188882+00	2026-04-21 04:07:59.188883+00	380	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b0f12feb-f422-440f-8935-731a8ff4b1fc	parth_valves	2026-04-21 04:07:59.188883+00	2026-04-21 04:07:59.188883+00	381	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
517d53fa-f258-4674-a838-780397baa8ad	parth_valves	2026-04-21 04:07:59.188884+00	2026-04-21 04:07:59.188884+00	382	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b663e8fd-9507-47df-818b-1f931c0fad29	parth_valves	2026-04-21 04:07:59.188884+00	2026-04-21 04:07:59.188885+00	383	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9450886b-7a1e-4b1d-b98c-c8442a13e276	parth_valves	2026-04-21 04:07:59.188885+00	2026-04-21 04:07:59.188885+00	384	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e55af379-f4df-482c-8432-4839ad85869b	parth_valves	2026-04-21 04:07:59.188886+00	2026-04-21 04:07:59.188886+00	385	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
019c97e3-df23-4cd9-b72b-f0bc1fc0b3bd	parth_valves	2026-04-21 04:07:59.188886+00	2026-04-21 04:07:59.188887+00	386	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e7f074e6-83d1-4d18-9f66-de24791a5952	parth_valves	2026-04-21 04:07:59.188887+00	2026-04-21 04:07:59.188887+00	387	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9dfeb09a-39c4-4ea5-9b78-fcea814907b5	parth_valves	2026-04-21 04:07:59.188888+00	2026-04-21 04:07:59.188888+00	388	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CI	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
976c4f92-700a-4eed-b53e-981c7648ad06	parth_valves	2026-04-21 04:07:59.188888+00	2026-04-21 04:07:59.188888+00	389	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CI	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
32fa9a22-317a-41f5-a3e7-28cae49abe71	parth_valves	2026-04-21 04:07:59.188889+00	2026-04-21 04:07:59.188889+00	390	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CI	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
07b9e8c5-0a9c-4125-aa0a-0706bba445ad	parth_valves	2026-04-21 04:07:59.18889+00	2026-04-21 04:07:59.18889+00	391	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CI	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4fb1d4b2-1d5d-4cbb-80bd-358b5fc4cf11	parth_valves	2026-04-21 04:07:59.18889+00	2026-04-21 04:07:59.188891+00	392	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c2981376-3374-4bc8-91eb-ac1f067dbf86	parth_valves	2026-04-21 04:07:59.188891+00	2026-04-21 04:07:59.188891+00	393	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2e733aa5-1d17-4c6e-8428-d1e971ebaa1c	parth_valves	2026-04-21 04:07:59.188892+00	2026-04-21 04:07:59.188892+00	394	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e95e3bd1-d449-429a-b283-ecdf72eda8d0	parth_valves	2026-04-21 04:07:59.188892+00	2026-04-21 04:07:59.188893+00	395	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
660cd351-a5a8-4554-a49e-4c9407be82f0	parth_valves	2026-04-21 04:07:59.188893+00	2026-04-21 04:07:59.188893+00	396	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f844f2ae-c7f9-4be2-bdf4-cc2383a9c4e3	parth_valves	2026-04-21 04:07:59.188894+00	2026-04-21 04:07:59.188894+00	397	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a8658a9b-2ae3-4a92-b840-277af3223658	parth_valves	2026-04-21 04:07:59.188894+00	2026-04-21 04:07:59.188895+00	398	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
d8792ac3-3b19-48e8-bbbd-8f862474929e	parth_valves	2026-04-21 04:07:59.188895+00	2026-04-21 04:07:59.188895+00	399	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
cac544a9-9afa-4765-9d23-64d6e469aa80	parth_valves	2026-04-21 04:07:59.188896+00	2026-04-21 04:07:59.188896+00	400	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
07fdc42a-a001-457a-8342-81ecc6d27546	parth_valves	2026-04-21 04:07:59.188896+00	2026-04-21 04:07:59.188896+00	401	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2a97e5d8-54e6-44e7-87ce-9d7c0a793f5b	parth_valves	2026-04-21 04:07:59.188897+00	2026-04-21 04:07:59.188897+00	402	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
12a6f90b-691e-41ad-a198-0c0e67f6960d	parth_valves	2026-04-21 04:07:59.188898+00	2026-04-21 04:07:59.188898+00	403	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
18aafb8e-dbc5-4d2f-b998-ea4e017016c2	parth_valves	2026-04-21 04:07:59.188898+00	2026-04-21 04:07:59.188898+00	404	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0244c523-86af-47c4-a0a5-ee4486599db1	parth_valves	2026-04-21 04:07:59.188899+00	2026-04-21 04:07:59.188899+00	405	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
72a6d7ac-2c8b-447c-a3e5-bf8cd9b5225d	parth_valves	2026-04-21 04:07:59.188899+00	2026-04-21 04:07:59.1889+00	406	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4b02d9fa-a605-47da-86f8-5c228dcc0bf9	parth_valves	2026-04-21 04:07:59.1889+00	2026-04-21 04:07:59.1889+00	407	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f557abdf-89b3-475a-a1bc-9df9aa3733e4	parth_valves	2026-04-21 04:07:59.188901+00	2026-04-21 04:07:59.188901+00	408	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
57f741f1-1621-4863-b424-25c1d6352da4	parth_valves	2026-04-21 04:07:59.188901+00	2026-04-21 04:07:59.188902+00	409	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9e47823a-99e1-479b-b6b3-d1aaf186342b	parth_valves	2026-04-21 04:07:59.188902+00	2026-04-21 04:07:59.188902+00	410	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ae736753-0fb5-4792-b99d-9031b3786d32	parth_valves	2026-04-21 04:07:59.188903+00	2026-04-21 04:07:59.188903+00	411	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
6fcc8fea-ea1e-4cbb-b056-7c0a53272341	parth_valves	2026-04-21 04:07:59.188903+00	2026-04-21 04:07:59.188904+00	412	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
17473180-a1ad-4486-9fa2-2ebb80cc586e	parth_valves	2026-04-21 04:07:59.188904+00	2026-04-21 04:07:59.188904+00	413	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c06bdc13-8d66-426d-84e7-7d02cf40c5f1	parth_valves	2026-04-21 04:07:59.188905+00	2026-04-21 04:07:59.188905+00	414	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
71ac356d-14ff-4cae-8601-8649c3d08de6	parth_valves	2026-04-21 04:07:59.188905+00	2026-04-21 04:07:59.188906+00	415	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
643b22f9-1e5a-447c-8c05-801a15442f41	parth_valves	2026-04-21 04:07:59.188906+00	2026-04-21 04:07:59.188906+00	416	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e171dee3-f5c3-4ee5-9dca-fbf72cad5fe1	parth_valves	2026-04-21 04:07:59.188907+00	2026-04-21 04:07:59.188907+00	417	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
8c789475-08e6-4f46-b418-5d40993cdb5d	parth_valves	2026-04-21 04:07:59.188907+00	2026-04-21 04:07:59.188908+00	418	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a764fb6f-d6da-40ce-85af-d590f737cd39	parth_valves	2026-04-21 04:07:59.188908+00	2026-04-21 04:07:59.188908+00	419	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a3878f29-ae29-4c83-aea4-d6bbb5a96d63	parth_valves	2026-04-21 04:07:59.188909+00	2026-04-21 04:07:59.188909+00	420	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2d79831e-e475-425f-a25b-1232ee493418	parth_valves	2026-04-21 04:07:59.188909+00	2026-04-21 04:07:59.18891+00	421	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
85b3192a-ee60-4651-9d04-907411496afd	parth_valves	2026-04-21 04:07:59.18891+00	2026-04-21 04:07:59.18891+00	422	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2fa4ec94-76b9-45fd-812c-34a0895ccf57	parth_valves	2026-04-21 04:07:59.188911+00	2026-04-21 04:07:59.188911+00	423	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f3ae59f2-b01e-4290-b8c5-11d30911a0ac	parth_valves	2026-04-21 04:07:59.188911+00	2026-04-21 04:07:59.188912+00	424	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
708fe3fc-5b87-4cc5-8180-f9fcd7bb70e6	parth_valves	2026-04-21 04:07:59.188912+00	2026-04-21 04:07:59.188912+00	425	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0b3e4c89-e271-490c-9227-4667e975fdd6	parth_valves	2026-04-21 04:07:59.188913+00	2026-04-21 04:07:59.188913+00	426	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e497ce4a-f269-414f-8ebd-826ec809d14f	parth_valves	2026-04-21 04:07:59.188913+00	2026-04-21 04:07:59.188914+00	427	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
6e4e2a1b-905e-4e7a-a205-e479e133f67d	parth_valves	2026-04-21 04:07:59.188914+00	2026-04-21 04:07:59.188914+00	428	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c703b131-af21-4599-8bb3-5ab4d357ba97	parth_valves	2026-04-21 04:07:59.188915+00	2026-04-21 04:07:59.188915+00	429	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
6c93a37a-0a77-4543-b2d9-3c4b2f83e0e4	parth_valves	2026-04-21 04:07:59.188915+00	2026-04-21 04:07:59.188916+00	430	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
61851682-5650-4ec0-aa92-e335e1912987	parth_valves	2026-04-21 04:07:59.188916+00	2026-04-21 04:07:59.188916+00	431	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
8b8b3b9a-4d8a-4705-93f0-6d24d84f4c39	parth_valves	2026-04-21 04:07:59.188917+00	2026-04-21 04:07:59.188917+00	432	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
1aa60304-fc2b-4f3d-8a6c-94cfc856d724	parth_valves	2026-04-21 04:07:59.188917+00	2026-04-21 04:07:59.188918+00	433	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
63a088c4-0404-485d-a316-9c6786a14bbc	parth_valves	2026-04-21 04:07:59.188918+00	2026-04-21 04:07:59.188918+00	434	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
66947ce6-b3d2-4060-a636-1e881390fe9c	parth_valves	2026-04-21 04:07:59.188919+00	2026-04-21 04:07:59.188919+00	435	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
113313ab-bba7-4f4b-83bf-256058a34528	parth_valves	2026-04-21 04:07:59.188919+00	2026-04-21 04:07:59.188919+00	436	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ac1381d6-6f95-4c00-9177-8788e1445645	parth_valves	2026-04-21 04:07:59.18892+00	2026-04-21 04:07:59.18892+00	437	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a513504d-0258-4b03-abd8-92ffd6bb469d	parth_valves	2026-04-21 04:07:59.188921+00	2026-04-21 04:07:59.188921+00	438	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
635de3be-5f07-46c7-b670-0648aafc36d9	parth_valves	2026-04-21 04:07:59.188921+00	2026-04-21 04:07:59.188921+00	439	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f505a3db-b2c8-46f0-baf3-7848f4663112	parth_valves	2026-04-21 04:07:59.188922+00	2026-04-21 04:07:59.188922+00	440	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2f0447e0-dc0b-4116-b623-b477fbccf65d	parth_valves	2026-04-21 04:07:59.188922+00	2026-04-21 04:07:59.188923+00	441	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ee5748e5-c83f-4da0-8111-121261a3a048	parth_valves	2026-04-21 04:07:59.188923+00	2026-04-21 04:07:59.188923+00	442	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
3a6300a3-285e-4f6c-b929-e5ac135095a1	parth_valves	2026-04-21 04:07:59.188924+00	2026-04-21 04:07:59.188924+00	443	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
45854caa-4368-4d05-9dc6-7ccdfe76b3af	parth_valves	2026-04-21 04:07:59.188924+00	2026-04-21 04:07:59.188925+00	444	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b5031557-a86d-4fad-9bfd-a513d67a99a5	parth_valves	2026-04-21 04:07:59.188925+00	2026-04-21 04:07:59.188925+00	445	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
89e239ca-029f-479e-bffa-733a58aef1c4	parth_valves	2026-04-21 04:07:59.188926+00	2026-04-21 04:07:59.188926+00	446	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b9d1ccf1-3d74-42ca-b987-22775ea5f40b	parth_valves	2026-04-21 04:07:59.188926+00	2026-04-21 04:07:59.188927+00	447	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
142a4e2c-3ecb-41f3-9e31-ae3a1a67a5cc	parth_valves	2026-04-21 04:07:59.188927+00	2026-04-21 04:07:59.188927+00	448	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ae583211-6f70-46a7-950f-b61f5c2e1b86	parth_valves	2026-04-21 04:07:59.188928+00	2026-04-21 04:07:59.188928+00	449	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
bc2dcd41-5135-4dab-8637-550e090b1615	parth_valves	2026-04-21 04:07:59.188928+00	2026-04-21 04:07:59.188929+00	450	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
21e6d18d-5859-4cdd-9ec0-5e299b00faed	parth_valves	2026-04-21 04:07:59.188929+00	2026-04-21 04:07:59.188929+00	451	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f6a213c0-1d33-4ea3-b3fc-347be5d9c9d4	parth_valves	2026-04-21 04:07:59.18893+00	2026-04-21 04:07:59.18893+00	452	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	WCB	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
06941a62-8c1d-4108-a23f-d6692f47f127	parth_valves	2026-04-21 04:07:59.188931+00	2026-04-21 04:07:59.188931+00	453	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	WCB	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
02b89b67-0791-4472-a6e0-36cd7aa2d80c	parth_valves	2026-04-21 04:07:59.188931+00	2026-04-21 04:07:59.188932+00	454	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	WCB	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
32163659-4e82-47c8-a932-7f9f7564cbfa	parth_valves	2026-04-21 04:07:59.188932+00	2026-04-21 04:07:59.188932+00	455	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	WCB	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
08693e77-a281-4ee5-bf19-c4089585983f	parth_valves	2026-04-21 04:07:59.188933+00	2026-04-21 04:07:59.188933+00	456	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
41c9cc0d-841e-4a37-97c2-34dca38883e7	parth_valves	2026-04-21 04:07:59.188933+00	2026-04-21 04:07:59.188934+00	457	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0fa26c44-829e-4675-9c66-9b97a622ae8a	parth_valves	2026-04-21 04:07:59.188934+00	2026-04-21 04:07:59.188934+00	458	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4b9d0ec6-87bb-441a-b51c-0a924f0bbc87	parth_valves	2026-04-21 04:07:59.188935+00	2026-04-21 04:07:59.188935+00	459	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
087a494b-a32e-4005-a66c-73a21c923ded	parth_valves	2026-04-21 04:07:59.188935+00	2026-04-21 04:07:59.188935+00	460	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
acad2e95-f0e7-431f-9003-1ce04ce78c23	parth_valves	2026-04-21 04:07:59.188936+00	2026-04-21 04:07:59.188936+00	461	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
dfe0a769-f098-4a1c-aae6-6f6c1681aa8a	parth_valves	2026-04-21 04:07:59.188937+00	2026-04-21 04:07:59.188937+00	462	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ebd9948e-83b8-49d8-8c95-2bc1ad4db02c	parth_valves	2026-04-21 04:07:59.188937+00	2026-04-21 04:07:59.188938+00	463	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
18555203-fab2-4615-a26f-b7f72f0cebeb	parth_valves	2026-04-21 04:07:59.188938+00	2026-04-21 04:07:59.188938+00	464	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
78f4d90d-5e2b-4dd8-a7f0-aaef46acf58e	parth_valves	2026-04-21 04:07:59.188939+00	2026-04-21 04:07:59.188939+00	465	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
5af51b3d-0e51-40ca-896d-aeb99110c4ca	parth_valves	2026-04-21 04:07:59.188939+00	2026-04-21 04:07:59.188939+00	466	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
19810b6e-9834-4507-ac79-ca680cb6371c	parth_valves	2026-04-21 04:07:59.18894+00	2026-04-21 04:07:59.18894+00	467	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
27cf9a9f-3f87-420a-a3cd-e1a70aa40dcf	parth_valves	2026-04-21 04:07:59.188941+00	2026-04-21 04:07:59.188941+00	468	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
6f6cb46b-7e33-4308-a99d-4553ec6eb811	parth_valves	2026-04-21 04:07:59.188941+00	2026-04-21 04:07:59.188941+00	469	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b81662d3-4ead-454d-8af4-8e2d8f58e6d1	parth_valves	2026-04-21 04:07:59.188942+00	2026-04-21 04:07:59.188942+00	470	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
717d3a19-ada4-430f-9146-893daa39b9f3	parth_valves	2026-04-21 04:07:59.188943+00	2026-04-21 04:07:59.188943+00	471	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
96ac56b7-045c-4d16-a34c-bb456e99063b	parth_valves	2026-04-21 04:07:59.188943+00	2026-04-21 04:07:59.188943+00	472	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
baff7d1e-8099-4c95-957c-2969ad7d3640	parth_valves	2026-04-21 04:07:59.188944+00	2026-04-21 04:07:59.188944+00	473	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f3240509-be91-4886-abd8-b363165e234a	parth_valves	2026-04-21 04:07:59.188944+00	2026-04-21 04:07:59.188945+00	474	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4f870d8e-6e3c-44d7-b231-8f3ab590a5ee	parth_valves	2026-04-21 04:07:59.188945+00	2026-04-21 04:07:59.188945+00	475	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
06f6e377-e2ef-4d92-ba3e-e688d099eea1	parth_valves	2026-04-21 04:07:59.188946+00	2026-04-21 04:07:59.188946+00	476	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
1c851da0-5b97-410a-b3af-3ecd1a396485	parth_valves	2026-04-21 04:07:59.188946+00	2026-04-21 04:07:59.188947+00	477	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
99c2db24-0e4c-4da8-9e47-172c5b8345bb	parth_valves	2026-04-21 04:07:59.188947+00	2026-04-21 04:07:59.188947+00	478	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0be0b7bd-cd53-4695-a90a-98d7c5770ec4	parth_valves	2026-04-21 04:07:59.188948+00	2026-04-21 04:07:59.188948+00	479	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c3e4c048-26b0-4a91-856c-0a22e423bcf5	parth_valves	2026-04-21 04:07:59.188948+00	2026-04-21 04:07:59.188949+00	480	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9c6cea8c-ec3e-40ea-80bb-7bde14d2c5f8	parth_valves	2026-04-21 04:07:59.188949+00	2026-04-21 04:07:59.188949+00	481	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a8567e67-9751-4146-aa69-1a8065f74075	parth_valves	2026-04-21 04:07:59.18895+00	2026-04-21 04:07:59.18895+00	482	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0752caa7-5dc2-4842-9d2b-d0520aca1351	parth_valves	2026-04-21 04:07:59.18895+00	2026-04-21 04:07:59.188951+00	483	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
900930c0-8477-43be-974e-daaed368f6b5	parth_valves	2026-04-21 04:07:59.188951+00	2026-04-21 04:07:59.188951+00	484	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
fcd1acba-d462-4a1d-b7cb-324361f1ebce	parth_valves	2026-04-21 04:07:59.188952+00	2026-04-21 04:07:59.188952+00	485	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4a902507-2272-4ac9-b94f-b0878c5368e6	parth_valves	2026-04-21 04:07:59.188952+00	2026-04-21 04:07:59.188953+00	486	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e0bff711-a551-4499-9878-2059f434b696	parth_valves	2026-04-21 04:07:59.188953+00	2026-04-21 04:07:59.188953+00	487	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
6b26982e-88c6-4a4a-a9c7-384309050d69	parth_valves	2026-04-21 04:07:59.188954+00	2026-04-21 04:07:59.188954+00	488	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
7caa4ab4-635e-401f-9b46-19e883ef98ec	parth_valves	2026-04-21 04:07:59.188954+00	2026-04-21 04:07:59.188955+00	489	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
fe803b27-b879-46d4-9110-fd4b7ce68ec9	parth_valves	2026-04-21 04:07:59.188955+00	2026-04-21 04:07:59.188955+00	490	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c102c83d-9a91-46c6-b939-0cddacd14e99	parth_valves	2026-04-21 04:07:59.188956+00	2026-04-21 04:07:59.188956+00	491	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4e15a4d7-def4-4f9d-8604-5b0f224ebaa8	parth_valves	2026-04-21 04:07:59.188956+00	2026-04-21 04:07:59.188957+00	492	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
cfc83b76-98f4-48a4-ae16-5424c0e73ac5	parth_valves	2026-04-21 04:07:59.188957+00	2026-04-21 04:07:59.188957+00	493	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
29fc902c-dd00-4c7f-b5f5-12a29a4a6634	parth_valves	2026-04-21 04:07:59.188958+00	2026-04-21 04:07:59.188958+00	494	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
291ea9db-2d31-46e0-a2d9-d3290b5dac1f	parth_valves	2026-04-21 04:07:59.188958+00	2026-04-21 04:07:59.188959+00	495	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
5ab175b2-a9bb-448b-a63d-72b281b99ef2	parth_valves	2026-04-21 04:07:59.188959+00	2026-04-21 04:07:59.188959+00	496	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
3a44e76e-819a-4ecf-9e16-639c00a4babe	parth_valves	2026-04-21 04:07:59.18896+00	2026-04-21 04:07:59.18896+00	497	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e0d6adfa-81e0-4086-8495-48b493f9658f	parth_valves	2026-04-21 04:07:59.18896+00	2026-04-21 04:07:59.188961+00	498	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
dcb38264-cd2e-4a28-b32b-2d99ca789dcd	parth_valves	2026-04-21 04:07:59.188961+00	2026-04-21 04:07:59.188961+00	499	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
caf0c690-3090-4531-82d1-f83e5625b6c4	parth_valves	2026-04-21 04:07:59.188962+00	2026-04-21 04:07:59.188962+00	500	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
22150436-2e69-4807-86b3-c3a578b3f110	parth_valves	2026-04-21 04:07:59.188962+00	2026-04-21 04:07:59.188963+00	501	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ce7743cb-020b-4cfc-a060-88c98fa507d3	parth_valves	2026-04-21 04:07:59.188963+00	2026-04-21 04:07:59.188963+00	502	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
1f77208e-4c4c-4fc9-85d3-8b4fbad1df0c	parth_valves	2026-04-21 04:07:59.188964+00	2026-04-21 04:07:59.188964+00	503	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
8ec50bfc-42e2-4685-9f12-21c36a0b51f7	parth_valves	2026-04-21 04:07:59.188964+00	2026-04-21 04:07:59.188965+00	504	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b1e3072d-a418-4299-97c9-9e0965242b7e	parth_valves	2026-04-21 04:07:59.188965+00	2026-04-21 04:07:59.188965+00	505	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a798a60a-c431-4623-9319-931bacc86d3f	parth_valves	2026-04-21 04:07:59.188966+00	2026-04-21 04:07:59.188966+00	506	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
93b48dc1-dcb5-42ef-b78b-fb2849ed2319	parth_valves	2026-04-21 04:07:59.188966+00	2026-04-21 04:07:59.188967+00	507	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a8075e54-1728-4a13-a0cf-a9ae9078f239	parth_valves	2026-04-21 04:07:59.188967+00	2026-04-21 04:07:59.188967+00	508	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
8766aa41-b4fb-4ba4-bb36-01a3469ee2c8	parth_valves	2026-04-21 04:07:59.188968+00	2026-04-21 04:07:59.188968+00	509	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
24372e15-6d92-4d09-8da7-31b58d0e6a82	parth_valves	2026-04-21 04:07:59.188968+00	2026-04-21 04:07:59.188969+00	510	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
7b6694fc-6572-49c1-b037-0d9d139fc0a6	parth_valves	2026-04-21 04:07:59.188969+00	2026-04-21 04:07:59.188969+00	511	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
beb0834d-ceff-4401-a260-a1a5ee47e2ee	parth_valves	2026-04-21 04:07:59.18897+00	2026-04-21 04:07:59.18897+00	512	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f88cab05-8bd1-44e1-90ad-664e3d4bb5c2	parth_valves	2026-04-21 04:07:59.18897+00	2026-04-21 04:07:59.188971+00	513	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b0186a5f-6cfa-4a24-90e9-4ac6ac1acf8a	parth_valves	2026-04-21 04:07:59.188971+00	2026-04-21 04:07:59.188971+00	514	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
861143fb-912e-44bf-b665-646db193722b	parth_valves	2026-04-21 04:07:59.188972+00	2026-04-21 04:07:59.188972+00	515	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
615397fd-7b4b-48da-ac65-45f06bb084e8	parth_valves	2026-04-21 04:07:59.188972+00	2026-04-21 04:07:59.188972+00	516	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CF8	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e3bb37f4-76c1-44bf-a39d-81fce64962ed	parth_valves	2026-04-21 04:07:59.188973+00	2026-04-21 04:07:59.188973+00	517	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CF8	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4a896301-03bd-460d-9dc1-a078cb667bdc	parth_valves	2026-04-21 04:07:59.188974+00	2026-04-21 04:07:59.188974+00	518	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CF8	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
83c7d0e0-62a9-4b31-8fb3-17594f0afa09	parth_valves	2026-04-21 04:07:59.188974+00	2026-04-21 04:07:59.188975+00	519	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CF8	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c74ca348-0613-42f6-8665-e07ac79a6fcd	parth_valves	2026-04-21 04:07:59.188975+00	2026-04-21 04:07:59.188975+00	520	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
27252c12-0d79-4842-b831-95b64b12d6c1	parth_valves	2026-04-21 04:07:59.188976+00	2026-04-21 04:07:59.188976+00	521	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0bfeb90f-3e45-42d6-8a9e-9d3ea04b16d7	parth_valves	2026-04-21 04:07:59.188976+00	2026-04-21 04:07:59.188977+00	522	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
026ae0f6-649d-4284-8b2d-9f7bcc771f26	parth_valves	2026-04-21 04:07:59.188977+00	2026-04-21 04:07:59.188977+00	523	Butterfly Valve	1-Piece, 2 Way	DN40	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
305c7cee-18ca-4b2a-8397-445ca162c6d9	parth_valves	2026-04-21 04:07:59.188978+00	2026-04-21 04:07:59.188978+00	524	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
4fc7be63-ca25-431b-b742-1261a64c3743	parth_valves	2026-04-21 04:07:59.188978+00	2026-04-21 04:07:59.188978+00	525	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
5994e473-0aac-4fd8-b3f4-6307a30ef262	parth_valves	2026-04-21 04:07:59.188979+00	2026-04-21 04:07:59.188979+00	526	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
61d14d51-c229-4d1f-8ea5-c74c9d426579	parth_valves	2026-04-21 04:07:59.18898+00	2026-04-21 04:07:59.18898+00	527	Butterfly Valve	1-Piece, 2 Way	DN50	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
08f585f4-03e0-41af-8e38-ea7382502c76	parth_valves	2026-04-21 04:07:59.18898+00	2026-04-21 04:07:59.18898+00	528	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
18c91c56-b72b-4c2f-a2db-7de7294c6d2a	parth_valves	2026-04-21 04:07:59.188981+00	2026-04-21 04:07:59.188981+00	529	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
47089b59-8327-4b46-9a15-82a5098d494d	parth_valves	2026-04-21 04:07:59.188981+00	2026-04-21 04:07:59.188982+00	530	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
d1ee89d9-f595-4886-aed3-88d45e9a4d1d	parth_valves	2026-04-21 04:07:59.188982+00	2026-04-21 04:07:59.188982+00	531	Butterfly Valve	1-Piece, 2 Way	DN65	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
0ee74dcc-940f-47dd-9f77-9500b996005e	parth_valves	2026-04-21 04:07:59.188983+00	2026-04-21 04:07:59.188983+00	532	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b73cab12-c904-4ee4-b0ae-b7eb52d36048	parth_valves	2026-04-21 04:07:59.188983+00	2026-04-21 04:07:59.188984+00	533	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
5e2a3ea7-7ef1-47a7-a949-eac7f189c6bb	parth_valves	2026-04-21 04:07:59.188984+00	2026-04-21 04:07:59.188984+00	534	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a15338ea-af2d-40bf-9437-8dfa31b49ffd	parth_valves	2026-04-21 04:07:59.188985+00	2026-04-21 04:07:59.188985+00	535	Butterfly Valve	1-Piece, 2 Way	DN80	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
1c02c35a-3edc-46a5-be76-d369cbbbe6ad	parth_valves	2026-04-21 04:07:59.188985+00	2026-04-21 04:07:59.188986+00	536	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
dba8aeac-d83e-4c68-b693-18aafbc557a8	parth_valves	2026-04-21 04:07:59.188986+00	2026-04-21 04:07:59.188986+00	537	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
867ad66e-28df-4052-9d05-2186d1b8d7a8	parth_valves	2026-04-21 04:07:59.188987+00	2026-04-21 04:07:59.188987+00	538	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e097408c-9478-44b7-a601-e40c4a5cf1b4	parth_valves	2026-04-21 04:07:59.188987+00	2026-04-21 04:07:59.188988+00	539	Butterfly Valve	1-Piece, 2 Way	DN100	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
88996bb8-3c7d-4270-83cc-c644a87d0629	parth_valves	2026-04-21 04:07:59.188988+00	2026-04-21 04:07:59.188988+00	540	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a68c0e95-c0c0-40da-adb7-ffa953cd9f60	parth_valves	2026-04-21 04:07:59.188989+00	2026-04-21 04:07:59.188989+00	541	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
487ed276-1804-4619-80b8-ec7e20365c4a	parth_valves	2026-04-21 04:07:59.188989+00	2026-04-21 04:07:59.18899+00	542	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
91dfb5b7-0720-4b0d-89be-e654a597a2be	parth_valves	2026-04-21 04:07:59.18899+00	2026-04-21 04:07:59.18899+00	543	Butterfly Valve	1-Piece, 2 Way	DN125	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b425caa7-f1ea-40be-8cbd-87a065b79b49	parth_valves	2026-04-21 04:07:59.188991+00	2026-04-21 04:07:59.188991+00	544	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
cf7dacbd-d7ec-47d6-aa95-bd7a147ee9a9	parth_valves	2026-04-21 04:07:59.188991+00	2026-04-21 04:07:59.188992+00	545	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
6a20163a-1c56-4252-a240-ec723b85eda4	parth_valves	2026-04-21 04:07:59.188992+00	2026-04-21 04:07:59.188992+00	546	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e03fad1a-7395-4049-b1a1-6fdf077adb89	parth_valves	2026-04-21 04:07:59.188993+00	2026-04-21 04:07:59.188993+00	547	Butterfly Valve	1-Piece, 2 Way	DN150	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
7a8cdf7e-db61-4736-b54f-a700493bb9bc	parth_valves	2026-04-21 04:07:59.188993+00	2026-04-21 04:07:59.188994+00	548	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b8468cf2-7938-469e-bc5d-c73ec101f29a	parth_valves	2026-04-21 04:07:59.188994+00	2026-04-21 04:07:59.188994+00	549	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
8ce0009e-4576-439b-96eb-84f409169536	parth_valves	2026-04-21 04:07:59.188995+00	2026-04-21 04:07:59.188995+00	550	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f21e0802-b79d-411f-9d28-dd0e27adaccd	parth_valves	2026-04-21 04:07:59.189+00	2026-04-21 04:07:59.189001+00	551	Butterfly Valve	1-Piece, 2 Way	DN200	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a5696b8d-e0a3-4203-b669-c60035009c8d	parth_valves	2026-04-21 04:07:59.189001+00	2026-04-21 04:07:59.189001+00	552	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
e60531b0-a529-45fa-a364-0538c750f9fb	parth_valves	2026-04-21 04:07:59.189002+00	2026-04-21 04:07:59.189002+00	553	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
08a001e2-afb9-43dd-a4e2-fc50c4fe842b	parth_valves	2026-04-21 04:07:59.189002+00	2026-04-21 04:07:59.189003+00	554	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
54b1ed0f-5030-4444-ad76-ffb943d3f3d7	parth_valves	2026-04-21 04:07:59.189003+00	2026-04-21 04:07:59.189003+00	555	Butterfly Valve	1-Piece, 2 Way	DN250	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
559a9f83-16b9-41d2-939f-306166589405	parth_valves	2026-04-21 04:07:59.189004+00	2026-04-21 04:07:59.189004+00	556	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
3cea2e2e-2e05-48b6-b1ae-c3cf25a559cd	parth_valves	2026-04-21 04:07:59.189004+00	2026-04-21 04:07:59.189005+00	557	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ac8556fb-adbc-4582-8aff-fca426b98734	parth_valves	2026-04-21 04:07:59.189005+00	2026-04-21 04:07:59.189005+00	558	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
47a7a34b-ee88-47b1-8ca4-f87624c4ab3c	parth_valves	2026-04-21 04:07:59.189006+00	2026-04-21 04:07:59.189006+00	559	Butterfly Valve	1-Piece, 2 Way	DN300	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f972a9f2-6ca4-43d8-936a-7cfc86cce9dc	parth_valves	2026-04-21 04:07:59.189006+00	2026-04-21 04:07:59.189007+00	560	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ad73db74-f5d4-4b0a-9990-c427802f1b86	parth_valves	2026-04-21 04:07:59.189007+00	2026-04-21 04:07:59.189007+00	561	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9d29f8fb-62b4-4e95-a085-89c6014a1fe5	parth_valves	2026-04-21 04:07:59.189008+00	2026-04-21 04:07:59.189008+00	562	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
ee382d3b-aebc-4c54-b498-05512d1d9a61	parth_valves	2026-04-21 04:07:59.189008+00	2026-04-21 04:07:59.189009+00	563	Butterfly Valve	1-Piece, 2 Way	DN350	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
30d87664-bd69-404e-aa42-d5f10247de20	parth_valves	2026-04-21 04:07:59.189009+00	2026-04-21 04:07:59.189009+00	564	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
7fd1c07f-1f3e-498d-a89e-d540c17dbc65	parth_valves	2026-04-21 04:07:59.18901+00	2026-04-21 04:07:59.18901+00	565	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
62ed551b-c211-4c43-81d4-2f3ae9eb82d5	parth_valves	2026-04-21 04:07:59.18901+00	2026-04-21 04:07:59.189011+00	566	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b66020d3-c370-4619-b052-9fad44fa947a	parth_valves	2026-04-21 04:07:59.189011+00	2026-04-21 04:07:59.189011+00	567	Butterfly Valve	1-Piece, 2 Way	DN400	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9140e55f-a83b-4e7f-bc7b-f7d6137021a7	parth_valves	2026-04-21 04:07:59.189012+00	2026-04-21 04:07:59.189012+00	568	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
a671e0f3-531f-4f2f-87b6-2bbb25fb845d	parth_valves	2026-04-21 04:07:59.189012+00	2026-04-21 04:07:59.189013+00	569	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
2c2dd89a-0580-4ffb-9492-290eeaf3f7df	parth_valves	2026-04-21 04:07:59.189013+00	2026-04-21 04:07:59.189013+00	570	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
7ff94ff0-4b0a-491a-8570-4f0d826df05b	parth_valves	2026-04-21 04:07:59.189014+00	2026-04-21 04:07:59.189014+00	571	Butterfly Valve	1-Piece, 2 Way	DN450	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
b2108204-f343-4a55-a4df-625ae909ad8f	parth_valves	2026-04-21 04:07:59.189014+00	2026-04-21 04:07:59.189015+00	572	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
f8820119-7931-4055-ad77-45073dfb05c4	parth_valves	2026-04-21 04:07:59.189015+00	2026-04-21 04:07:59.189015+00	573	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
860a062d-b02a-4767-aa93-5ee71da51d34	parth_valves	2026-04-21 04:07:59.189016+00	2026-04-21 04:07:59.189016+00	574	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9db8a91f-d9ef-4fab-b959-34fe6e1dfe6f	parth_valves	2026-04-21 04:07:59.189016+00	2026-04-21 04:07:59.189017+00	575	Butterfly Valve	1-Piece, 2 Way	DN500	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
5db7c7b2-e4dd-4210-bb54-089d9eceff55	parth_valves	2026-04-21 04:07:59.189017+00	2026-04-21 04:07:59.189017+00	576	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
87ee36bb-610b-499a-b363-6dbb23bd9b08	parth_valves	2026-04-21 04:07:59.189018+00	2026-04-21 04:07:59.189018+00	577	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
11897ccd-a101-4b60-b7ff-6badea2b193d	parth_valves	2026-04-21 04:07:59.189018+00	2026-04-21 04:07:59.189019+00	578	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
8710f6e3-cbb9-4ae5-830a-684d3ad128e0	parth_valves	2026-04-21 04:07:59.189019+00	2026-04-21 04:07:59.189019+00	579	Butterfly Valve	1-Piece, 2 Way	DN550	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
cf7b2387-b647-494f-afba-12a6d1da0f36	parth_valves	2026-04-21 04:07:59.18902+00	2026-04-21 04:07:59.18902+00	580	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CF8M	SGI	SS410	EPDM	MS	\N	Files 30-39 (PN16)
9587695d-4401-4e5f-8a70-7345babe5670	parth_valves	2026-04-21 04:07:59.18902+00	2026-04-21 04:07:59.189021+00	581	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CF8M	WCB	SS410	EPDM	MS	\N	Files 30-39 (PN16)
cb034312-483e-467c-82ef-8f6e6e5efe9d	parth_valves	2026-04-21 04:07:59.189021+00	2026-04-21 04:07:59.189021+00	582	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CF8M	CF8	SS410	EPDM	MS	\N	Files 30-39 (PN16)
c22b792e-a739-48cd-9143-9e2dad612f1a	parth_valves	2026-04-21 04:07:59.189022+00	2026-04-21 04:07:59.189022+00	583	Butterfly Valve	1-Piece, 2 Way	DN600	Full Bore	Wafer	PN16	CF8M	CF8M	SS410	EPDM	MS	\N	Files 30-39 (PN16)
\.


--
-- Data for Name: catalog_limit_switch_box; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.catalog_limit_switch_box (row_id, client_id, created_at, updated_at, sr_no, variant_type, price_inr) FROM stdin;
560d78a2-63cb-4537-a999-325fcae57c7d	parth_valves	2026-04-21 04:07:59.32418+00	2026-04-21 04:07:59.324183+00	1	Wheather proof with Mechanical Switches	1200
be858d2d-de74-49c0-95b9-168710f84bea	parth_valves	2026-04-21 04:07:59.324184+00	2026-04-21 04:07:59.324184+00	2	Flame proof with Mechanical Switches	3500
127a162e-e473-4416-9cb7-298c21d2f36c	parth_valves	2026-04-21 04:07:59.324184+00	2026-04-21 04:07:59.324185+00	3	Wheather proof with proximity Switches	8600
f5cbb10f-a449-486d-b0f3-8ab9fb07d3c4	parth_valves	2026-04-21 04:07:59.324185+00	2026-04-21 04:07:59.324186+00	4	Flame proof with Proximity Switches	16700
\.


--
-- Data for Name: catalog_operator; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.catalog_operator (row_id, client_id, created_at, updated_at, operator_for, construct, size_text, model_name, price_inr) FROM stdin;
b773c863-320a-428a-ad5f-9ee725d8e4df	parth_valves	2026-04-21 04:07:59.299944+00	2026-04-21 04:07:59.299947+00	Ball Valve	2 Way	1/2"	DA55	3999
94fbc03a-5ede-471a-bc48-b3dd5e024ea5	parth_valves	2026-04-21 04:07:59.299947+00	2026-04-21 04:07:59.299948+00	Ball Valve	2 Way	1/2"	SA55	4862
4292cd15-b1dd-472e-9ff4-d12f224cd8e9	parth_valves	2026-04-21 04:07:59.299948+00	2026-04-21 04:07:59.299949+00	Ball Valve	2 Way	3/4"	DA55	3999
1dd53fe6-3fa7-4617-bb76-339ef79460c4	parth_valves	2026-04-21 04:07:59.299949+00	2026-04-21 04:07:59.299949+00	Ball Valve	2 Way	3/4"	SA55	4862
43b03769-a28d-4849-9289-faac7f0d8326	parth_valves	2026-04-21 04:07:59.299951+00	2026-04-21 04:07:59.299951+00	Ball Valve	2 Way	1"	SA65	6051
fb06a31b-add0-4ee2-a2ee-9ec9e6d1f5c6	parth_valves	2026-04-21 04:07:59.299951+00	2026-04-21 04:07:59.299952+00	Ball Valve	2 Way	1 1/4"	DA55	3999
b759784b-d603-4999-8895-c721f095ff42	parth_valves	2026-04-21 04:07:59.299952+00	2026-04-21 04:07:59.299952+00	Ball Valve	2 Way	1 1/4"	SA75	7323
0cc52259-91da-4aac-b9b1-c2c641788ff4	parth_valves	2026-04-21 04:07:59.299953+00	2026-04-21 04:07:59.299953+00	Ball Valve	2 Way	1 1/2"	DA55	3999
7560e867-639d-402f-bb0f-e71d84224232	parth_valves	2026-04-21 04:07:59.299953+00	2026-04-21 04:07:59.299954+00	Ball Valve	2 Way	1 1/2"	SA75	7323
5659e6d6-0f3a-488e-a039-df5ebe8c701d	parth_valves	2026-04-21 04:07:59.299954+00	2026-04-21 04:07:59.299954+00	Ball Valve	2 Way	2"	DA65	5041
8e513f93-a2cd-41bc-ac46-49d341f6bd64	parth_valves	2026-04-21 04:07:59.299955+00	2026-04-21 04:07:59.299955+00	Ball Valve	2 Way	2"	SA85	9202
783fb5ff-8b56-486a-acd8-de7f39e4e936	parth_valves	2026-04-21 04:07:59.299955+00	2026-04-21 04:07:59.299956+00	Ball Valve	2 Way	2 1/2"	DA75	5985
572364c7-e362-49d5-aee1-e9ac08592550	parth_valves	2026-04-21 04:07:59.299956+00	2026-04-21 04:07:59.299956+00	Ball Valve	2 Way	2 1/2"	SA100	12000
69183baf-3168-4870-bbac-c337e5e786ab	parth_valves	2026-04-21 04:07:59.299957+00	2026-04-21 04:07:59.299957+00	Ball Valve	2 Way	3"	DA85	7552
ac184381-5931-48bd-901c-cee7e99db70f	parth_valves	2026-04-21 04:07:59.299957+00	2026-04-21 04:07:59.299958+00	Ball Valve	2 Way	3"	SA115	16074
0cae12e5-51ce-4520-80dd-a112f057f85f	parth_valves	2026-04-21 04:07:59.299958+00	2026-04-21 04:07:59.299959+00	Ball Valve	2 Way	4"	DA115	13371
357ac296-83b6-413e-b453-49da8ddc047b	parth_valves	2026-04-21 04:07:59.299959+00	2026-04-21 04:07:59.299959+00	Ball Valve	2 Way	4"	SA150	31911
6c3f9a4e-3958-4f65-910d-76239649e255	parth_valves	2026-04-21 04:07:59.29996+00	2026-04-21 04:07:59.29996+00	Ball Valve	2 Way	5"	DA125	16184
231579b6-2802-4cca-95cd-afa06d093b42	parth_valves	2026-04-21 04:07:59.29996+00	2026-04-21 04:07:59.299961+00	Ball Valve	2 Way	5"	SA150	31911
9a91bae7-253b-4a81-bf2a-88c7c869111f	parth_valves	2026-04-21 04:07:59.299961+00	2026-04-21 04:07:59.299961+00	Ball Valve	2 Way	6"	DA150	25837
8660475d-bbc9-42be-8d61-702676939650	parth_valves	2026-04-21 04:07:59.299962+00	2026-04-21 04:07:59.299962+00	Ball Valve	2 Way	6"	SA200	70602
7b2afbdf-d4ee-4466-a7e4-dc119f1ec0ca	parth_valves	2026-04-21 04:07:59.299962+00	2026-04-21 04:07:59.299963+00	Ball valve	3 way	1/2"	DA55	3999
38a70eff-3f31-48d0-b6fe-78c3e4a68804	parth_valves	2026-04-21 04:07:59.299963+00	2026-04-21 04:07:59.299963+00	Ball valve	3 way	1/2"	SA55	4862
c2d8ac92-bcd0-4b14-96ab-a55c6111664d	parth_valves	2026-04-21 04:07:59.299964+00	2026-04-21 04:07:59.299964+00	Ball valve	3 way	3/4"	DA55	3999
ec725b33-2013-4273-af1f-50dd91c18be1	parth_valves	2026-04-21 04:07:59.299964+00	2026-04-21 04:07:59.299965+00	Ball valve	3 way	3/4"	SA55	4862
4c0e0c24-50d2-42bd-84f0-40b340b508a6	parth_valves	2026-04-21 04:07:59.29995+00	2026-04-21 08:43:14.610015+00	Ball Valve	2 Way	1"	DA55	3999
55894293-f783-4b2d-9022-0715a11e58b5	parth_valves	2026-04-21 04:07:59.299965+00	2026-04-21 04:07:59.299965+00	Ball valve	3 way	1"	DA55	3999
bb3f6ed5-12c8-43f8-8a8c-f3a39dd1305b	parth_valves	2026-04-21 04:07:59.299966+00	2026-04-21 04:07:59.299966+00	Ball valve	3 way	1"	SA65	6051
c9141b93-1e55-4a99-9cc8-4f90d83c4827	parth_valves	2026-04-21 04:07:59.299967+00	2026-04-21 04:07:59.299967+00	Ball valve	3 way	1 1/4"	DA55	3999
86d0c3b1-b34c-4d36-9511-5a0ca0b1b069	parth_valves	2026-04-21 04:07:59.299967+00	2026-04-21 04:07:59.299967+00	Ball valve	3 way	1 1/4"	SA75	7323
9d901b84-7b9b-4b80-9070-3117b076c0cb	parth_valves	2026-04-21 04:07:59.299968+00	2026-04-21 04:07:59.299968+00	Ball valve	3 way	1 1/2"	DA65	5041
e8485077-7019-48b4-8f8d-dcfbead731a8	parth_valves	2026-04-21 04:07:59.299969+00	2026-04-21 04:07:59.299969+00	Ball valve	3 way	1 1/2"	SA85	9202
f1ec2dce-8d24-4825-a64c-080379d85f1d	parth_valves	2026-04-21 04:07:59.299969+00	2026-04-21 04:07:59.29997+00	Ball valve	3 way	2"	DA75	5985
348a47c5-7bac-487e-a237-fca6d02a5f26	parth_valves	2026-04-21 04:07:59.29997+00	2026-04-21 04:07:59.29997+00	Ball valve	3 way	2"	SA100	12000
6c966ee9-c464-4f0d-98ac-7594479df450	parth_valves	2026-04-21 04:07:59.299971+00	2026-04-21 04:07:59.299971+00	Ball valve	3 way	2 1/2"	DA85	7552
e59ba130-f99d-42c5-b975-6f5c4b197f79	parth_valves	2026-04-21 04:07:59.299971+00	2026-04-21 04:07:59.299972+00	Ball valve	3 way	2 1/2"	SA115	16074
90be8891-c357-41cd-bba3-d2896a920b49	parth_valves	2026-04-21 04:07:59.299972+00	2026-04-21 04:07:59.299972+00	Ball valve	3 way	3"	DA100	9831
d566a7f7-4574-47f8-bcac-cc538db64a70	parth_valves	2026-04-21 04:07:59.299973+00	2026-04-21 04:07:59.299973+00	Ball valve	3 way	3"	SA125	20119
c7dcbf4f-f3e7-4d93-8948-14ff14bbb7ab	parth_valves	2026-04-21 04:07:59.299973+00	2026-04-21 04:07:59.299974+00	Ball valve	3 way	4"	DA125	16184
645c8a08-3ad7-44ed-91fe-6b1e6f0611cf	parth_valves	2026-04-21 04:07:59.299974+00	2026-04-21 04:07:59.299974+00	Ball valve	3 way	4"	SA150	31911
9fa1ce0f-c06c-4be5-95cf-3f2259d4625a	parth_valves	2026-04-21 04:07:59.299975+00	2026-04-21 04:07:59.299975+00	Ball valve	3 way	5"	DA150	25837
30b73d2a-3716-40e0-a31d-b018fdc08b82	parth_valves	2026-04-21 04:07:59.299975+00	2026-04-21 04:07:59.299976+00	Ball valve	3 way	5"	SA200	70602
2f0b8795-62da-49ac-9305-c13fbe42f820	parth_valves	2026-04-21 04:07:59.299976+00	2026-04-21 04:07:59.299976+00	Ball valve	3 way	6"	DA150	25837
37d674e6-23b7-4b59-bf3b-8b81085f589b	parth_valves	2026-04-21 04:07:59.299977+00	2026-04-21 04:07:59.299977+00	Ball valve	3 way	6"	SA200	70602
\.


--
-- Data for Name: catalog_positioner; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.catalog_positioner (row_id, client_id, created_at, updated_at, sr_no, variant_type, price_inr) FROM stdin;
426136c2-2830-408f-8a24-44e0770cf5ab	parth_valves	2026-04-21 04:07:59.32913+00	2026-04-21 04:07:59.329133+00	1	Pneumatic- Pneumatic Positioner, Make- Rotork	18500
f2d78098-267b-494c-be30-5875ad6eed5e	parth_valves	2026-04-21 04:07:59.329134+00	2026-04-21 04:07:59.329134+00	2	Electro- Pneumatic Positioner without PTR, Make- Rotork	35000
ac4df923-e553-46f8-b435-92ed9f395a41	parth_valves	2026-04-21 04:07:59.329135+00	2026-04-21 04:07:59.329135+00	3	Electro- Pneumatic Positioner without PTR, Make- Rotex	23000
832af8c8-2e17-4243-a263-27924bdab52c	parth_valves	2026-04-21 04:07:59.329136+00	2026-04-21 04:07:59.329136+00	4	Electro- Pneumatic Positioner with PTR, Make- Rotork	54000
f0eb502c-01fb-415b-b42e-de9bed3a1dc5	parth_valves	2026-04-21 04:07:59.329136+00	2026-04-21 04:07:59.329137+00	5	Electro- Pneumatic Positioner with PTR, Make- Rotex	28000
26f8783b-8967-463f-aa95-c29ecec7fd4d	parth_valves	2026-04-21 04:07:59.329137+00	2026-04-21 04:07:59.329137+00	6	SMART Positioner with HART , Make- Rotork	65000
e571f30b-eabd-4723-856d-7a290ddc5f28	parth_valves	2026-04-21 04:07:59.329138+00	2026-04-21 04:07:59.329138+00	7	SMART Positioner with HART , Make- Rotex	60000
\.


--
-- Data for Name: catalog_sov; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.catalog_sov (row_id, client_id, created_at, updated_at, sr_no, variant_type, price_inr) FROM stdin;
94b9a626-8f6e-469f-88ea-a67176270713	parth_valves	2026-04-21 04:07:59.318113+00	2026-04-21 04:07:59.318116+00	1	5X2 SOV, Namur Type, Coil Voltage- 24 VDC, Wheather Proof	1250
7c19d914-0ca9-45e2-8da1-94ae92847281	parth_valves	2026-04-21 04:07:59.318117+00	2026-04-21 04:07:59.318117+00	2	5X2 SOV, Namur Type, Coil Voltage- 230 VAC, Wheather Proof	1300
c83603b6-f6a8-44dc-9ed5-c42cabf78931	parth_valves	2026-04-21 04:07:59.318117+00	2026-04-21 04:07:59.318118+00	3	5X2 SOV, Non Namur Type, Coil Voltage- 24 VDC, Wheather Proof	1200
167c3d2a-f9fa-47ba-ab6b-6a598a3622f9	parth_valves	2026-04-21 04:07:59.318118+00	2026-04-21 04:07:59.318119+00	4	5X2 SOV, Non Type, Coil Voltage- 230 VAC, Wheather Proof	1300
53139f48-f5a3-4508-9847-05bdf9dd9083	parth_valves	2026-04-21 04:07:59.318119+00	2026-04-21 04:07:59.318119+00	5	3X2 SOV, Namur Type, Coil Voltage- 24 VDC, Wheather Proof	1250
01360087-acde-4c55-975c-22aa4d3ceb81	parth_valves	2026-04-21 04:07:59.31812+00	2026-04-21 04:07:59.31812+00	6	3X2 SOV, Namur Type, Coil Voltage- 230 VAC, Wheather Proof	1300
e239affc-9fe3-4b0f-bceb-8b51e5901002	parth_valves	2026-04-21 04:07:59.318121+00	2026-04-21 04:07:59.318121+00	7	3X2 SOV, Non Namur Type, Coil Voltage- 24 VDC, Wheather Proof	1200
c9d37661-a481-407c-8058-4e9e1da5d101	parth_valves	2026-04-21 04:07:59.318121+00	2026-04-21 04:07:59.318122+00	8	3X2 SOV, Non Type, Coil Voltage- 230 VAC, Wheather Proof	1300
e7cfe39d-afd6-4dc3-a66f-8db3493ac291	parth_valves	2026-04-21 04:07:59.318122+00	2026-04-21 04:07:59.318122+00	9	5X2 SOV, Namur Type, Coil Voltage- 24 VDC, Explosion Proof	7800
0ebea132-b52a-4a06-93c8-c0a0dc63e9cc	parth_valves	2026-04-21 04:07:59.318123+00	2026-04-21 04:07:59.318123+00	10	3X2 SOV, Namur Type, Coil Voltage- 24 VDC,Explosion Proof	8100
\.


--
-- Data for Name: client_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.client_records (id, company_name, contact_name, email, phone, city, country, erp_code, is_erp_synced, source, enquiry_count, notes, created_at, updated_at) FROM stdin;
87029e71-b4e2-4a68-ad0c-83f040b3a8d3	Unknown	AKASH	akashpan225622@gmail.com	+(91)-9770881484	\N	India	\N	f	email	1	\N	2026-04-17 05:31:28.377849+00	2026-04-17 05:31:28.377849+00
a45e262a-ad1e-45c3-a666-87359eaa3445	Unknown	AKASH	akashpan225622@gmail.com	+(91)-9770881484	\N	India	\N	f	email	1	\N	2026-04-17 05:33:01.709517+00	2026-04-17 05:33:01.709517+00
084a9832-1058-469a-bec0-eabd9deb42d3	Unknown	AKASH	akashpan225622@gmail.com	+919770881484	\N	India	\N	f	email	1	\N	2026-04-17 05:58:31.974595+00	2026-04-17 05:58:31.974595+00
70bdf94d-7af7-40a2-a689-bb4e9dee4348	Unknown	AKASH	akashpan225622@gmail.com	+919770881484	\N	India	\N	f	email	1	\N	2026-04-17 06:45:02.210941+00	2026-04-17 06:45:02.210941+00
b00104fd-44ab-438d-b385-49803c392107	Unknown	AKASH	akashpan225622@gmail.com	+(91)-9770881484	\N	India	\N	f	email	1	\N	2026-04-17 06:50:39.990877+00	2026-04-17 06:50:39.990877+00
d4a187d0-5cf2-41fe-90ea-47ac9eabb189	Unknown	AKASH	akashpan225622@gmail.com	+(91)-9770881484	\N	India	\N	f	email	1	\N	2026-04-17 07:40:04.26556+00	2026-04-17 07:40:04.26556+00
3cf930b2-05a7-4a36-bf7b-c649657cb862	Unknown	Rohit	\N	\N	\N	India	\N	f	email	1	\N	2026-04-17 07:44:51.291652+00	2026-04-17 07:44:51.291652+00
54d7cbad-d4ca-4071-9753-1b1385319172	Unknown	Rohit	\N	\N	\N	India	\N	f	email	1	\N	2026-04-17 07:56:59.268948+00	2026-04-17 07:56:59.268948+00
48b7d1e4-9ac7-4eb0-944f-5c085ae5dc0d	Apex Pharma	\N	\N	\N	\N	India	\N	f	email	1	\N	2026-04-17 08:01:42.448481+00	2026-04-17 08:01:42.448481+00
11b7673d-2104-4e3e-b1e2-039aedfca503	Unknown	Sneha Kulkarni	\N	\N	\N	India	\N	f	email	1	\N	2026-04-17 08:04:50.357873+00	2026-04-17 08:04:50.357873+00
0d512991-2f23-422d-b4ed-04bfc81ea597	Shena Steel Works Pvt. Ltd.	Sneha Kulkarni	snehakulkarni@gmail.com	9812012345	\N	India	\N	f	email	3	\N	2026-04-17 08:11:23.000784+00	2026-04-17 08:25:14.591823+00
e390847d-9321-4237-9d7a-27582196610e	Shena Steel Works Pvt. Ltd.	Sneha Kulkarni	snehakulkarni@gmail.com	9812012345	\N	India	\N	f	email	1	\N	2026-04-17 08:30:03.485316+00	2026-04-17 08:30:03.485316+00
\.


--
-- Data for Name: email_sync_state; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_sync_state (id, baseline_at) FROM stdin;
1	2026-04-17 04:50:05.324865+00
\.


--
-- Data for Name: enquiries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.enquiries (id, client_config, raw_input, input_type, status, client_id, erp_export_path, parsed_data, matched_products, confidence_score, ai_reasoning, missing_fields, assigned_to, flow_type, error_message, created_at, updated_at, processing_started_at, processing_completed_at) FROM stdin;
b4f4ae6a-ea10-41e4-ab4e-b3a131597def	parth_valves	I have been introduced to your company by IndiaMART. I am looking for SS Sight View Glass.\n\nBelow are the requirement details :\nQuantity\t:\t4 Piece\nSize\t:\t1.5 inch\nConnection Type\t:\tFlange\nProbable Order Value\t:\tRs. 5,400 - 6,600\nProbable Requirement Type\t:\tBusiness Use\nBelow are the Buyer details :\nMember since\t:\tmore than 5 years\nProducts of Interest\t:\tHouse Name Plates,eSSL Biometric Attendance System,Honeywell Pressure Switches\nRequirements till now\t:\t4\nRegards\nAKASH\nIndore, Madhya Pradesh, India\nEmail: akashpan225622@gmail.com ✓\nMobile: +(91)-9770881484 ✓	email	approved	87029e71-b4e2-4a68-ad0c-83f040b3a8d3	output/erp_exports/EnquiryList_B4F4AE6A_20260417.xlsx	{"client_name": "AKASH", "client_company": null, "client_email": "akashpan225622@gmail.com", "client_phone": "+(91)-9770881484", "products_requested": [{"category": "sight_glass", "product_description": "SS Sight View Glass", "quantity": 4, "size_inch": 1.5, "size_mm": null, "pressure_rating": null, "material": "SS", "application": "Business Use", "cascade_filters": {"sub_category": "Full View Sight Glass", "body_material": "Stainless Steel", "end_connection": "Flanged End", "size": "1.5\\""}}], "additional_notes": "Enquiry sourced from IndiaMART. Buyer is located in Indore, Madhya Pradesh. Stated probable order value is Rs. 5,400 - 6,600.", "enquiry_type": "incomplete", "missing_fields": ["pressure_rating", "drilling_std", "body_material"], "confidence": 0.95}	[]	0.95	Parser: flow_type=incomplete, confidence=0.95, products=1, missing=['pressure_rating', 'drilling_std', 'body_material']\nSendNode: approved by human — email ready to send	[]	\N	incomplete	\N	2026-04-17 05:30:20.551968+00	2026-04-17 05:31:50.692456+00	\N	\N
37a56b29-4da2-4fa5-a382-5a7c599aade7	parth_valves	I have been introduced to your company by IndiaMART. I am looking for SS Sight View Glass.\n\nBelow are the requirement details :\nQuantity\t:\t4 Piece\nSize\t:\t1.5 inch\nConnection Type\t:\tFlange\nProbable Order Value\t:\tRs. 5,400 - 6,600\nProbable Requirement Type\t:\tBusiness Use\nBelow are the Buyer details :\nMember since\t:\tmore than 5 years\nProducts of Interest\t:\tHouse Name Plates,eSSL Biometric Attendance System,Honeywell Pressure Switches\nRequirements till now\t:\t4\nRegards\nAKASH\nIndore, Madhya Pradesh, India\nEmail: akashpan225622@gmail.com ✓\nMobile: +(91)-9770881484 ✓	email	pending_client_verification	a45e262a-ad1e-45c3-a666-87359eaa3445	output/erp_exports/EnquiryList_37A56B29_20260417.xlsx	{"client_name": "AKASH", "client_company": null, "client_email": "akashpan225622@gmail.com", "client_phone": "+(91)-9770881484", "products_requested": [{"category": "sight_glass", "product_description": "SS Sight View Glass", "quantity": 4, "size_inch": 1.5, "size_mm": null, "pressure_rating": null, "material": "SS", "application": "Business Use", "cascade_filters": {"size": "1.5\\"", "body_material": "Stainless Steel", "end_connection": "Flange"}}], "additional_notes": "Sourced via IndiaMART. Probable Order Value: Rs. 5,400 - 6,600. Buyer is from Indore, Madhya Pradesh.", "enquiry_type": "incomplete", "missing_fields": ["pressure_rating", "drilling_std", "body_material", "sub_category"], "confidence": 0.95}	\N	0.95	Parser: flow_type=incomplete, confidence=0.95, products=1, missing=['pressure_rating', 'drilling_std', 'body_material', 'sub_category']	["pressure_rating", "drilling_std", "body_material", "sub_category"]	\N	incomplete	\N	2026-04-17 05:32:32.287072+00	2026-04-17 05:33:01.804835+00	\N	\N
5b78391f-b936-4702-a649-a3b4c212c24b	parth_valves	I have been introduced to your company by IndiaMART. I am looking for SS Sight View Glass.\n\nBelow are the requirement details :\nQuantity\t:\t4 Piece\nSize\t:\t1.5 inch\nConnection Type\t:\tFlange\nProbable Order Value\t:\tRs. 5,400 - 6,600\nProbable Requirement Type\t:\tBusiness Use\nBelow are the Buyer details :\nMember since\t:\tmore than 5 years\nProducts of Interest\t:\tHouse Name Plates,eSSL Biometric Attendance System,Honeywell Pressure Switches\nRequirements till now\t:\t4\nRegards\nAKASH\nIndore, Madhya Pradesh, India\nEmail: akashpan225622@gmail.com ✓\nMobile: +(91)-9770881484 ✓	email	pending_client_verification	084a9832-1058-469a-bec0-eabd9deb42d3	output/erp_exports/EnquiryList_5B78391F_20260417.xlsx	{"client_name": "AKASH", "client_company": null, "client_email": "akashpan225622@gmail.com", "client_phone": "+919770881484", "products_requested": [{"category": "sight_glass", "product_description": "SS Sight View Glass", "quantity": 4, "size_inch": 1.5, "size_mm": null, "pressure_rating": null, "material": "SS", "application": "Business Use", "cascade_filters": {"size": "1.5\\"", "body_material": "Stainless Steel", "end_connection": "Flanged"}}], "additional_notes": "Enquiry sourced from IndiaMART. Customer has a probable order value budget of Rs. 5,400 - 6,600.", "enquiry_type": "incomplete", "missing_fields": ["pressure_rating", "drilling_std", "body_material"], "confidence": 0.95}	\N	0.95	Parser: flow_type=incomplete, confidence=0.95, products=1, missing=['pressure_rating', 'drilling_std', 'body_material']	["pressure_rating", "drilling_std", "body_material"]	\N	incomplete	\N	2026-04-17 05:57:39.397516+00	2026-04-17 05:58:32.19031+00	\N	\N
2d0eed5d-f592-4cdb-8764-c95d1aa45103	parth_valves	I have been introduced to your company by IndiaMART. I am looking for SS Sight View Glass.\n\nBelow are the requirement details :\nQuantity\t:\t4 Piece\nSize\t:\t1.5 inch\nConnection Type\t:\tFlange\nProbable Order Value\t:\tRs. 5,400 - 6,600\nProbable Requirement Type\t:\tBusiness Use\nBelow are the Buyer details :\nMember since\t:\tmore than 5 years\nProducts of Interest\t:\tHouse Name Plates,eSSL Biometric Attendance System,Honeywell Pressure Switches\nRequirements till now\t:\t4\nRegards\nAKASH\nIndore, Madhya Pradesh, India\nEmail: akashpan225622@gmail.com ✓\nMobile: +(91)-9770881484 ✓	email	approved	b00104fd-44ab-438d-b385-49803c392107	output/erp_exports/EnquiryList_2D0EED5D_20260417.xlsx	{"client_name": "AKASH", "client_company": null, "client_email": "akashpan225622@gmail.com", "client_phone": "+(91)-9770881484", "products_requested": [{"category": "sight_glass", "product_description": "SS Sight View Glass", "quantity": 4, "size_inch": 1.5, "size_mm": null, "pressure_rating": null, "material": "SS", "application": "Business Use", "cascade_filters": {"product": "Sight Glass", "size": "1.5\\"", "body_material": "SS", "end_connection": "Flanged"}}], "additional_notes": "Enquiry sourced from IndiaMART. Buyer has indicated a probable order value of Rs. 5,400 - 6,600.", "enquiry_type": "incomplete", "missing_fields": ["pressure_rating", "drilling_std", "body_material (specific grade, e.g., SS304/SS316)"], "confidence": 0.95}	[{"matched": true, "product_id": "sight_glass:11a9b46f-75f3-41f4-861b-d1052d161c77", "product_name": "Full View Sight Glass", "material": "CF8 / PTFE / NA / CF8", "size_inch": null, "size_mm": 20.0, "base_price": 2363.0, "unit": "piece", "match_confidence": 1.0, "match_source": "cascade", "category": "sight_glass", "cascade_filters": {"product": "Full View Sight Glass", "sub_category": "Sight Glass", "body_material": "CF8", "seat_material": "PTFE", "pressure_rating": "Class 150", "end_connection": "Flanged End", "drilling_std": "ANSI B16.5 #150", "moc_variant": "CF8", "size": "DN20"}}]	0.95	Parser: flow_type=incomplete, confidence=0.95, products=1, missing=['pressure_rating', 'drilling_std', 'body_material (specific grade, e.g., SS304/SS316)']\nQuote built: QT-20260417-07F8EAE6, total=₹11436.92, items=1, status=approved\nSendNode: approved by human — quotation ready to send	[]	\N	complete	\N	2026-04-17 06:50:19.589814+00	2026-04-17 06:51:29.316462+00	\N	\N
2889b0c6-2733-4971-8033-b9040332da28	parth_valves	From: Prathamesh Chavan <sales@parthvalve.com>\nDate: Fri, 17 Apr 2026 09:13:25 +0000\nSubject: FW: RFQ- Pneumatically Actuated Ball Valve with Accessories (Limit\r\n Switch & Solenoid Valve)\n\nOn Mon, Apr 6, 2026 at 3:45 PM Gajendra Khawale <gajendra.khawale@procmart.com<mailto:gajendra.khawale@procmart.com>> wrote:\r\nHello Sir,\r\n\r\nWe have a requirement from one of our clients for resale.\r\n\r\nPlease share your quotation with technical and commercial details. Also include the HSN code, delivery charges, stock availability, and delivery time\r\n\r\nRequirement-\r\n\r\n\r\nItem 1:\r\n·        Size: DN 20\r\n·        Body: WCB\r\n·        Trim: SS316\r\n·        Solid Ball\r\n·        PTFE Seat & Seal\r\n·        2 Pc Design, Full Bore\r\n·        Flanged, Class 150\r\n·        Pneumatic Actuator : EBRO EB 4.1 SYD (Double Acting) With Limit Switch: SBU-M203-K214-M01 Solenoid Valve: HERION 8010777.3033, 24VDC (Single Solenoid Valve with Coil)\r\n·        Quantity: 5 Nos\r\n\r\n\r\nItem 2:\r\n·        Size: DN 80\r\n·        Body: WCB\r\n·        Trim: SS316\r\n·        Solid Ball\r\n·        PTFE Seat & Seal\r\n·        2 Pc Design, Full Bore\r\n·        Flanged, Class 150\r\n·        Pneumatic Actuator: EB 6.1 SYD (Double Acting) With Limit Switch: SBU-M203-K214-M01 Solenoid Valve: HERION 8010777.3033, 24VDC (Single Solenoid Valve with Coil)\r\n·        Quantity: 4 Nos\r\n\r\n\r\n\r\n Please share the Quotation at the earliest.\r\n--\r\n-- Best Regards,\r\n\r\n[https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpVqwVWXi5y52LhRVT1VcpSzp8obNROSkgneCpjjY2fFIoX40y&s]\r\n\r\nGajendra Khawale\r\n\r\nProcurement Executive-Operations\r\n\r\nProcMart\r\n[https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/phone-icon-2x.png]\r\n7020126044\r\n[https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/email-icon-2x.png]\r\ngajendra.khawale@procmart.com<mailto:vishal.chitbone@procmart.com>\r\n[https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/link-icon-2x.png]\r\nwww.procmart.com<http://ec2-34-221-130-80.us-west-2.compute.amazonaws.com/x/d?c=28957687&l=d77cf391-8fcd-45c6-805a-df7564b4ce24&r=26eb6a74-a0aa-43bc-9b0c-f1b4abb39be8>\r\n\r\nINSTANT PROCUREMENT SERVICES PVT LTD\r\nBuilding No- A-201/202\r\n34, Aundh Road, Bhau Patil Marg,\r\nPune-411020, Maharashtra. India	email_sync	pending_client_verification	\N	\N	{"client_name": "Gajendra Khawale", "client_company": "ProcMart", "client_email": "gajendra.khawale@procmart.com", "client_phone": "7020126044", "products_requested": [{"category": "ball_valve", "product_description": "Size: DN 20, Body: WCB, Trim: SS316, Solid Ball, PTFE Seat & Seal, 2 Pc Design, Full Bore, Flanged, Class 150, Pneumatic Actuator : EBRO EB 4.1 SYD (Double Acting) With Limit Switch: SBU-M203-K214-M01 Solenoid Valve: HERION 8010777.3033, 24VDC (Single Solenoid Valve with Coil)", "quantity": 5, "size_inch": "3/4\\"", "size_mm": "DN20", "pressure_rating": "Class 150", "material": "Body: WCB, Trim: SS316", "application": "resale", "cascade_filters": {"size": "DN20", "sub_category": "Ball Valve", "product": "Pneumatic Actuated Ball Valve", "design": "2 Pc Design, Full Bore", "body_material": "WCB", "seat_material": "PTFE", "stem_material": "SS316", "moc_variant": "SS316", "pressure_rating": "Class 150", "end_connection": "Flanged", "operator_config": "Pneumatic Actuator (Double Acting) with Limit Switch & Solenoid Valve"}}, {"category": "ball_valve", "product_description": "Size: DN 80, Body: WCB, Trim: SS316, Solid Ball, PTFE Seat & Seal, 2 Pc Design, Full Bore, Flanged, Class 150, Pneumatic Actuator: EB 6.1 SYD (Double Acting) With Limit Switch: SBU-M203-K214-M01 Solenoid Valve: HERION 8010777.3033, 24VDC (Single Solenoid Valve with Coil)", "quantity": 4, "size_inch": "3\\"", "size_mm": "DN80", "pressure_rating": "Class 150", "material": "Body: WCB, Trim: SS316", "application": "resale", "cascade_filters": {"size": "DN80", "sub_category": "Ball Valve", "product": "Pneumatic Actuated Ball Valve", "design": "2 Pc Design, Full Bore", "body_material": "WCB", "seat_material": "PTFE", "stem_material": "SS316", "moc_variant": "SS316", "pressure_rating": "Class 150", "end_connection": "Flanged", "operator_config": "Pneumatic Actuator (Double Acting) with Limit Switch & Solenoid Valve"}}], "additional_notes": "Client requests quotation with technical and commercial details, HSN code, delivery charges, stock availability, and delivery time. The requirement is for resale.", "enquiry_type": "complete", "missing_fields": ["drilling_std"], "confidence": 1.0}	\N	1	Parser: flow_type=complete, confidence=1.00, products=2, missing=['drilling_std']	["drilling_std"]	\N	complete	\N	2026-04-17 09:14:28.740316+00	2026-04-17 09:14:53.94854+00	\N	\N
70f4ae07-405c-4274-b7c4-750665c98524	parth_valves	I have been introduced to your company by IndiaMART. I am looking for SS Sight View Glass.\n\nBelow are the requirement details :\nQuantity\t:\t4 Piece\nSize\t:\t1.5 inch\nConnection Type\t:\tFlange\nProbable Order Value\t:\tRs. 5,400 - 6,600\nProbable Requirement Type\t:\tBusiness Use\nBelow are the Buyer details :\nMember since\t:\tmore than 5 years\nProducts of Interest\t:\tHouse Name Plates,eSSL Biometric Attendance System,Honeywell Pressure Switches\nRequirements till now\t:\t4\nRegards\nAKASH\nIndore, Madhya Pradesh, India\nEmail: akashpan225622@gmail.com ✓\nMobile: +(91)-9770881484 ✓	email	approved	70bdf94d-7af7-40a2-a689-bb4e9dee4348	output/erp_exports/EnquiryList_70F4AE07_20260417.xlsx	{"client_name": "AKASH", "client_company": null, "client_email": "akashpan225622@gmail.com", "client_phone": "+919770881484", "products_requested": [{"category": "sight_glass", "product_description": "SS Sight View Glass", "quantity": 4, "size_inch": 1.5, "size_mm": null, "pressure_rating": null, "material": "SS", "application": "Business Use", "cascade_filters": {"product": "Sight Glass", "size": "1.5\\"", "body_material": "Stainless Steel", "end_connection": "Flanged"}}], "additional_notes": "Enquiry sourced from IndiaMART. Buyer's probable order value is Rs. 5,400 - 6,600.", "enquiry_type": "incomplete", "missing_fields": ["pressure_rating", "drilling_std", "moc_variant", "sub_category"], "confidence": 0.95}	[{"matched": true, "product_id": "sight_glass:d9af5793-6ddc-4c0e-aba2-1244167cc75d", "product_name": "Double Window Sight Glass", "material": "CF8M / PTFE / NA / CF8M", "size_inch": null, "size_mm": 40.0, "base_price": 6001.0, "unit": "piece", "match_confidence": 1.0, "match_source": "cascade", "category": "sight_glass", "cascade_filters": {"product": "Double Window Sight Glass", "sub_category": "Sight Glass", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "Class 150", "end_connection": "Screwed / Socket Weld End", "drilling_std": "BS 5351", "moc_variant": "CF8M", "size": "DN40"}}]	0.95	Parser: flow_type=incomplete, confidence=0.95, products=1, missing=['pressure_rating', 'drilling_std', 'moc_variant', 'sub_category']\nQuote built: QT-20260417-1C57FCF9, total=₹29044.84, items=1, status=approved\nSendNode: approved by human — quotation ready to send	[]	\N	complete	\N	2026-04-17 06:44:36.136212+00	2026-04-17 06:45:38.160173+00	\N	\N
4c04bc91-65c1-4ac2-8150-c73c0e9db4d3	parth_valves	Subject: RFQ – Ball valves (sizes + qty)\n\nHi Team,\nPlease quote 3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE.\nSize 15 MM Qty 10\nSize 20 MM Qty 6\nDelivery: Ahmedabad.\nRegards,\nRohit	email	pending_client_verification	\N	\N	{"client_name": "Rohit", "client_company": null, "client_email": null, "client_phone": null, "products_requested": [{"category": "ball_valve", "product_description": "3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE. Size 15 MM", "quantity": 10, "size_inch": "1/2\\"", "size_mm": 15, "pressure_rating": "ASME B16.5 #150", "material": "Body CF8M, seat PTFE", "application": null, "cascade_filters": {"sub_category": "3 Piece Design", "product": "Ball Valve", "design": "Flanged End", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "150#", "end_connection": "Flanged", "drilling_std": "ASME B16.5", "operator_config": "Lever Operated", "size": "DN15"}}, {"category": "ball_valve", "product_description": "3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE. Size 20 MM", "quantity": 6, "size_inch": "3/4\\"", "size_mm": 20, "pressure_rating": "ASME B16.5 #150", "material": "Body CF8M, seat PTFE", "application": null, "cascade_filters": {"sub_category": "3 Piece Design", "product": "Ball Valve", "design": "Flanged End", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "150#", "end_connection": "Flanged", "drilling_std": "ASME B16.5", "operator_config": "Lever Operated", "size": "DN20"}}], "additional_notes": "Delivery required to Ahmedabad.", "enquiry_type": "complete", "missing_fields": ["client_company", "client_email", "client_phone", "stem_material", "moc_variant", "paint_finish"], "confidence": 0.95}	\N	0.95	Parser: flow_type=complete, confidence=0.95, products=2, missing=['client_company', 'client_email', 'client_phone', 'stem_material', 'moc_variant', 'paint_finish']	["client_company", "client_email", "client_phone", "stem_material", "moc_variant", "paint_finish"]	\N	complete	\N	2026-04-17 07:53:33.424546+00	2026-04-17 07:53:59.542624+00	\N	\N
b4a465b0-17cd-463a-ac41-e6ad99a082e0	parth_valves	Subject: RFQ – Ball valves (sizes + qty) Body: Hi Team, Please quote 3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE.\n* Size 15 MM Qty 10\n* Size 20 MM Qty 6 Delivery: Ahmedabad. Regards, Rohit	email	pending_human_review	3cf930b2-05a7-4a36-bf7b-c649657cb862	output/erp_exports/EnquiryList_B4A465B0_20260417.xlsx	{"client_name": "Rohit", "client_company": null, "client_email": null, "client_phone": null, "products_requested": [{"category": "ball_valve", "product_description": "3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE. Size 15 MM", "quantity": 10, "size_inch": "1/2\\"", "size_mm": 15, "pressure_rating": "ASME B16.5 #150", "material": "Body CF8M, seat PTFE", "application": null, "cascade_filters": {"product": "Ball Valve", "design": "3-piece", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "150#", "end_connection": "Flanged End", "drilling_std": "ASME B16.5", "operator_config": "Handle Lever", "size": "DN15"}}, {"category": "ball_valve", "product_description": "3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE. Size 20 MM", "quantity": 6, "size_inch": "3/4\\"", "size_mm": 20, "pressure_rating": "ASME B16.5 #150", "material": "Body CF8M, seat PTFE", "application": null, "cascade_filters": {"product": "Ball Valve", "design": "3-piece", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "150#", "end_connection": "Flanged End", "drilling_std": "ASME B16.5", "operator_config": "Handle Lever", "size": "DN20"}}], "additional_notes": "Delivery required to Ahmedabad.", "enquiry_type": "complete", "missing_fields": ["client_company", "client_email", "client_phone", "stem_material", "paint_finish", "moc_variant"], "confidence": 0.98}	[]	0.98	Parser: flow_type=complete, confidence=0.98, products=2, missing=['client_company', 'client_email', 'client_phone', 'stem_material', 'paint_finish', 'moc_variant']\nMatcher: used DB cascade\nMissingFields: generated clarification for []\nEmailComposer: email composed by AI\nEmailComposer: email edited by human	[]	\N	not_found	\N	2026-04-17 07:44:07.184832+00	2026-04-17 07:46:18.428402+00	\N	\N
4ff6598e-8ab5-441a-8142-b40445ad41cf	parth_valves	Dear Pramod Gaikwad,\n\nI have been introduced to your company by IndiaMART. I am looking for SS Sight View Glass.\n\nBelow are the requirement details :\nQuantity\t:\t4 Piece\nSize\t:\t1.5 inch\nConnection Type\t:\tFlange\nProbable Order Value\t:\tRs. 5,400 - 6,600\nProbable Requirement Type\t:\tBusiness Use\nBelow are the Buyer details :\nMember since\t:\tmore than 5 years\nProducts of Interest\t:\tHouse Name Plates,eSSL Biometric Attendance System,Honeywell Pressure Switches\nRequirements till now\t:\t4\nRegards\nAKASH\nIndore, Madhya Pradesh, India\nEmail: akashpan225622@gmail.com ✓\nMobile: +(91)-9770881484 ✓	email	approved	d4a187d0-5cf2-41fe-90ea-47ac9eabb189	output/erp_exports/EnquiryList_4FF6598E_20260417.xlsx	{"client_name": "AKASH", "client_company": null, "client_email": "akashpan225622@gmail.com", "client_phone": "+(91)-9770881484", "products_requested": [{"category": "sight_glass", "product_description": "SS Sight View Glass", "quantity": 4, "size_inch": 1.5, "size_mm": null, "pressure_rating": null, "material": "SS", "application": "Business Use", "cascade_filters": {"size": "1.5\\"", "body_material": "Stainless Steel", "end_connection": "Flanged End"}}], "additional_notes": "Enquiry from IndiaMART. Probable Order Value: Rs. 5,400 - 6,600.", "enquiry_type": "incomplete", "missing_fields": ["pressure_rating", "drilling_std", "sub_category"], "confidence": 0.95}	[{"matched": true, "product_id": "sight_glass:93e12545-1afc-49a8-9633-9ee895b7f79f", "product_name": "Double Window Sight Glass", "material": "WCB / PTFE / NA / WCB", "size_inch": null, "size_mm": 80.0, "base_price": 15147.0, "unit": "piece", "match_confidence": 1.0, "match_source": "cascade", "category": "sight_glass", "cascade_filters": {"sub_category": "Sight Glass", "product": "Double Window Sight Glass", "body_material": "WCB", "seat_material": "PTFE", "pressure_rating": "Class 150", "end_connection": "Flanged End", "drilling_std": "BS 5351", "moc_variant": "WCB", "size": "DN80"}}]	0.95	Parser: flow_type=incomplete, confidence=0.95, products=1, missing=['pressure_rating', 'drilling_std', 'sub_category']\nQuote built: QT-20260417-58475F35, total=₹73311.48, items=1, status=approved\nSendNode: approved by human — quotation ready to send	[]	\N	complete	\N	2026-04-17 07:39:30.468231+00	2026-04-17 07:41:51.09351+00	\N	\N
dca86ecd-6c02-40b3-99bf-3b98c8e3ed63	parth_valves	Subject: RFQ – Wafer Type Butterfly Valve, PN16 (DN100 & DN150)\n\nBody: Dear Marketing Team,\nWe need your quotation for the following butterfly valves for a water line application.\n\nProduct: Butterfly Valve – Wafer Type\nPressure Rating: PN16\nEnd Connection: Wafer\nBody Material: Ductile Iron\nDisc (MOC Variant): SS316\nSeat Material: EPDM\nStem Material: SS410\nOperator Config: Lever (manual)\nPaint Finish: Blue epoxy coated\n\nSizes & quantity:\n\nDN100 (4”) – Qty 4 Nos\nDN150 (6”) – Qty 2 Nos\nDelivery: Pune, Maharashtra\nPacking: Individual packing with test certificate\nPlease mention make/model, unit rate, GST, lead time, and warranty.\n\nWarm regards,\nSneha Kulkarni	email	pending_human_review	11b7673d-2104-4e3e-b1e2-039aedfca503	output/erp_exports/EnquiryList_DCA86ECD_20260417.xlsx	{"client_name": "Sneha Kulkarni", "client_company": null, "client_email": null, "client_phone": null, "products_requested": [{"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN100 (4\\u201d)", "quantity": 4, "size_inch": "4\\"", "size_mm": "DN100", "pressure_rating": "PN16", "material": "Body: Ductile Iron, Disc: SS316, Seat: EPDM, Stem: SS410", "application": "water line application", "cascade_filters": {"sub_category": "Wafer Type", "product": "Butterfly Valve", "design": null, "body_material": "Ductile Iron", "seat_material": "EPDM", "stem_material": "SS410", "pressure_rating": "PN16", "end_connection": "Wafer", "drilling_std": null, "paint_finish": "Blue Epoxy Coated", "operator_config": "Lever", "disc_moc_variant": "SS316", "size": "DN100 / 4\\""}}, {"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN150 (6\\u201d)", "quantity": 2, "size_inch": "6\\"", "size_mm": "DN150", "pressure_rating": "PN16", "material": "Body: Ductile Iron, Disc: SS316, Seat: EPDM, Stem: SS410", "application": "water line application", "cascade_filters": {"sub_category": "Wafer Type", "product": "Butterfly Valve", "design": null, "body_material": "Ductile Iron", "seat_material": "EPDM", "stem_material": "SS410", "pressure_rating": "PN16", "end_connection": "Wafer", "drilling_std": null, "paint_finish": "Blue Epoxy Coated", "operator_config": "Lever", "disc_moc_variant": "SS316", "size": "DN150 / 6\\""}}], "additional_notes": "Delivery to Pune, Maharashtra. Requires individual packing with test certificate. Please mention make/model, unit rate, GST, lead time, and warranty in the quotation.", "enquiry_type": "complete", "missing_fields": ["design", "drilling_std"], "confidence": 1.0}	[]	1	Parser: flow_type=complete, confidence=1.00, products=2, missing=['design', 'drilling_std']\nMatcher: used DB cascade\nMissingFields: generated clarification for []\nEmailComposer: email composed by AI\nEmailComposer: email edited by human\nEmailComposer: email edited by human\nEmailComposer: email edited by human\nEmailComposer: email edited by human\nEmailComposer: email edited by human	[]	\N	not_found	\N	2026-04-17 08:04:25.930665+00	2026-04-17 08:10:31.921842+00	\N	\N
94d3f247-0776-40b7-a537-04995423de0a	parth_valves	Subject: RFQ – Ball valves (sizes + qty) Body: Hi Team, Please quote 3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE.\n* Size 15 MM Qty 10\n* Size 20 MM Qty 6 Delivery: Ahmedabad. Regards, Rohit	email	awaiting_info	\N	\N	{"client_name": "Rohit", "client_company": null, "client_email": null, "client_phone": null, "products_requested": [{"category": "ball_valve", "product_description": "3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE. Size 15 MM", "quantity": 10, "size_inch": "1/2\\"", "size_mm": 15, "pressure_rating": "150#", "material": "Body CF8M, seat PTFE", "application": null, "cascade_filters": {"sub_category": "Floating", "product": "3-Piece Design Ball Valve", "design": "3-Piece", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "Class 150", "end_connection": "Flanged End", "drilling_std": "ASME B16.5", "operator_config": "Lever Operated", "size": "DN15"}}, {"category": "ball_valve", "product_description": "3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE. Size 20 MM", "quantity": 6, "size_inch": "3/4\\"", "size_mm": 20, "pressure_rating": "150#", "material": "Body CF8M, seat PTFE", "application": null, "cascade_filters": {"sub_category": "Floating", "product": "3-Piece Design Ball Valve", "design": "3-Piece", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "Class 150", "end_connection": "Flanged End", "drilling_std": "ASME B16.5", "operator_config": "Lever Operated", "size": "DN20"}}], "additional_notes": "Delivery required to Ahmedabad.", "enquiry_type": "complete", "missing_fields": ["client_company", "client_email", "client_phone", "stem_material", "paint_finish", "moc_variant"], "confidence": 0.95}	[]	0.95	Parser: flow_type=complete, confidence=0.95, products=2, missing=['client_company', 'client_email', 'client_phone', 'stem_material', 'paint_finish', 'moc_variant']	[]	\N	not_found	\N	2026-04-17 07:56:18.055735+00	2026-04-17 07:57:12.512993+00	\N	\N
5c21722f-d8fa-4e5f-ab1c-719b5a6d79b1	parth_valves	Subject: RFQ – Ball valves (sizes + qty)\n\nHi Team,\nPlease quote 3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE.\nSize 15 MM Qty 10\nSize 20 MM Qty 6\nDelivery: Ahmedabad.\nRegards,\nRohit	email	pending_client_verification	\N	\N	{"client_name": "Rohit", "client_company": null, "client_email": null, "client_phone": null, "products_requested": [{"category": "ball_valve", "product_description": "3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE. Size 15 MM", "quantity": 10, "size_inch": "1/2\\"", "size_mm": 15, "pressure_rating": "ASME B16.5 #150", "material": "Body CF8M, seat PTFE", "application": null, "cascade_filters": {"sub_category": "3 Piece Design", "product": "Ball Valve", "design": "Flanged End", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "150#", "end_connection": "Flanged", "drilling_std": "ASME B16.5", "operator_config": "Handle Lever", "size": "DN15"}}, {"category": "ball_valve", "product_description": "3-piece Ball Valve with handle, Flanged End, ASME B16.5 #150, Body CF8M, seat PTFE. Size 20 MM", "quantity": 6, "size_inch": "3/4\\"", "size_mm": 20, "pressure_rating": "ASME B16.5 #150", "material": "Body CF8M, seat PTFE", "application": null, "cascade_filters": {"sub_category": "3 Piece Design", "product": "Ball Valve", "design": "Flanged End", "body_material": "CF8M", "seat_material": "PTFE", "pressure_rating": "150#", "end_connection": "Flanged", "drilling_std": "ASME B16.5", "operator_config": "Handle Lever", "size": "DN20"}}], "additional_notes": "Delivery required in Ahmedabad.", "enquiry_type": "complete", "missing_fields": ["client_company", "client_email", "client_phone", "stem_material", "paint_finish", "moc_variant"], "confidence": 0.98}	\N	0.98	Parser: flow_type=complete, confidence=0.98, products=2, missing=['client_company', 'client_email', 'client_phone', 'stem_material', 'paint_finish', 'moc_variant']	["client_company", "client_email", "client_phone", "stem_material", "paint_finish", "moc_variant"]	\N	complete	\N	2026-04-17 07:59:50.136366+00	2026-04-17 08:00:15.518983+00	\N	\N
4e2e81df-4cc4-46d8-a2cb-04259f8bd816	parth_valves	Need quotation for Butterfly Valve PN04, Wafer, Bare Shaft.\n* DN100 Qty 4 (variant SS304)\n* DN150 Qty 2 (variant SS316) Please share rate per piece + GST. Thanks, Apex Pharma – Purchase	email	approved	48b7d1e4-9ac7-4eb0-944f-5c085ae5dc0d	output/erp_exports/EnquiryList_4E2E81DF_20260417.xlsx	{"client_name": null, "client_company": "Apex Pharma", "client_email": null, "client_phone": null, "products_requested": [{"category": "butterfly_valve", "product_description": "Butterfly Valve PN04, Wafer, Bare Shaft. DN100 Qty 4 (variant SS304)", "quantity": 4, "size_inch": "4\\"", "size_mm": "DN100", "pressure_rating": "PN04", "material": "SS304 Disc", "application": null, "cascade_filters": {"sub_category": "Wafer", "product": "Wafer Type Butterfly Valve", "pressure_rating": "PN04", "end_connection": "Wafer", "operator_config": "Bare Shaft", "disc_moc_variant": "SS304", "size": "DN100"}}, {"category": "butterfly_valve", "product_description": "Butterfly Valve PN04, Wafer, Bare Shaft. DN150 Qty 2 (variant SS316)", "quantity": 2, "size_inch": "6\\"", "size_mm": "DN150", "pressure_rating": "PN04", "material": "SS316 Disc", "application": null, "cascade_filters": {"sub_category": "Wafer", "product": "Wafer Type Butterfly Valve", "pressure_rating": "PN04", "end_connection": "Wafer", "operator_config": "Bare Shaft", "disc_moc_variant": "SS316", "size": "DN150"}}], "additional_notes": "Please share rate per piece + GST.", "enquiry_type": "incomplete", "missing_fields": ["body_material", "seat_material", "drilling_std"], "confidence": 0.95}	[]	0.95	Parser: flow_type=incomplete, confidence=0.95, products=2, missing=['body_material', 'seat_material', 'drilling_std']\nSendNode: approved by human — email ready to send	[]	\N	incomplete	\N	2026-04-17 08:01:20.618473+00	2026-04-17 08:02:20.597768+00	\N	\N
a1fb8b71-7a52-47d4-9c84-ef95ca70c9e7	parth_valves	Subject: RFQ – Wafer Type Butterfly Valve, PN16 (DN100 & DN150)\n\nBody: Dear Marketing Team,\nWe need your quotation for the following butterfly valves for a water line application.\n\nProduct: Butterfly Valve – Wafer Type\nPressure Rating: PN16\nEnd Connection: Wafer\nBody Material: Ductile Iron\nDisc (MOC Variant): SS316\nSeat Material: EPDM\nStem Material: SS410\nOperator Config: Lever (manual)\nPaint Finish: Blue epoxy coated\n\nSizes & quantity:\n\nDN100 (4”) – Qty 4 Nos\nDN150 (6”) – Qty 2 Nos\nDelivery: Pune, Maharashtra\nPacking: Individual packing with test certificate\nPlease mention make/model, unit rate, GST, lead time, and warranty.\n\nWarm regards,\nSneha Kulkarni\nsnehakulkarni@gmail.com\nShena Steel Works Pvt. Ltd.\n9812012345	email	pending_human_review	0d512991-2f23-422d-b4ed-04bfc81ea597	output/erp_exports/EnquiryList_A1FB8B71_20260417.xlsx	{"client_name": "Sneha Kulkarni", "client_company": "Shena Steel Works Pvt. Ltd.", "client_email": "snehakulkarni@gmail.com", "client_phone": "9812012345", "products_requested": [{"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN100 (4\\u201d)", "quantity": 4, "size_inch": "4\\"", "size_mm": "DN100", "pressure_rating": "PN16", "material": "Ductile Iron", "application": "water line application", "cascade_filters": {"product": "Butterfly Valve", "sub_category": "Wafer Type", "size": "DN100", "body_material": "Ductile Iron", "disc_moc_variant": "SS316", "seat_material": "EPDM", "stem_material": "SS410", "pressure_rating": "PN16", "end_connection": "Wafer", "operator_config": "Lever", "paint_finish": "Blue epoxy coated"}}, {"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN150 (6\\u201d)", "quantity": 2, "size_inch": "6\\"", "size_mm": "DN150", "pressure_rating": "PN16", "material": "Ductile Iron", "application": "water line application", "cascade_filters": {"product": "Butterfly Valve", "sub_category": "Wafer Type", "size": "DN150", "body_material": "Ductile Iron", "disc_moc_variant": "SS316", "seat_material": "EPDM", "stem_material": "SS410", "pressure_rating": "PN16", "end_connection": "Wafer", "operator_config": "Lever", "paint_finish": "Blue epoxy coated"}}], "additional_notes": "Delivery to Pune, Maharashtra. Requires individual packing with test certificate. Customer also requests make/model, unit rate, GST, lead time, and warranty information in the quotation.", "enquiry_type": "complete", "missing_fields": [], "confidence": 1.0}	[]	1	Parser: flow_type=complete, confidence=1.00, products=2, missing=[]\nMatcher: used DB cascade\nMissingFields: generated clarification for []\nEmailComposer: email composed by AI	[]	\N	not_found	\N	2026-04-17 08:10:36.508001+00	2026-04-17 08:11:57.922408+00	\N	\N
d958e073-5844-4d03-9e8b-1ee1ae07e03a	parth_valves	Subject: RFQ – Wafer Type Butterfly Valve, PN16 (DN100 & DN150)\n\nDear Marketing Team,\nWe need your quotation for the following butterfly valves for a water line application.\n\nProduct: Butterfly Valve – Wafer Type\nPressure Rating: PN16\nEnd Connection: Wafer\nBody Material: Ductile Iron\nDisc (MOC Variant): SS316\nSeat Material: EPDM\nStem Material: SS410\nOperator Config: Lever (manual)\nPaint Finish: Blue epoxy coated\n\nSizes & quantity:\nDN100 (4") – Qty 4 Nos\nDN150 (6") – Qty 2 Nos\nDelivery: Pune, Maharashtra\nPacking: Individual packing with test certificate\n\nWarm regards,\nSneha Kulkarni\nsnehakulkarni@gmail.com\nShena Steel Works Pvt. Ltd.\n9812012345	email	pending_client_verification	0d512991-2f23-422d-b4ed-04bfc81ea597	\N	{"client_name": "Sneha Kulkarni", "client_company": "Shena Steel Works Pvt. Ltd.", "client_email": "snehakulkarni@gmail.com", "client_phone": "9812012345", "products_requested": [{"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN100 (4\\")", "quantity": 4, "size_inch": "4\\"", "size_mm": "DN100", "pressure_rating": "PN16", "material": "Body: Ductile Iron, Disc: SS316, Seat: EPDM, Stem: SS410", "application": "water line", "cascade_filters": {"product": "Butterfly Valve", "sub_category": "Wafer Type", "size": "DN100", "pressure_rating": "PN16", "end_connection": "Wafer", "body_material": "Ductile Iron", "disc_moc_variant": "SS316", "seat_material": "EPDM", "stem_material": "SS410", "operator_config": "Lever", "paint_finish": "Blue epoxy coated"}}, {"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN150 (6\\")", "quantity": 2, "size_inch": "6\\"", "size_mm": "DN150", "pressure_rating": "PN16", "material": "Body: Ductile Iron, Disc: SS316, Seat: EPDM, Stem: SS410", "application": "water line", "cascade_filters": {"product": "Butterfly Valve", "sub_category": "Wafer Type", "size": "DN150", "pressure_rating": "PN16", "end_connection": "Wafer", "body_material": "Ductile Iron", "disc_moc_variant": "SS316", "seat_material": "EPDM", "stem_material": "SS410", "operator_config": "Lever", "paint_finish": "Blue epoxy coated"}}], "additional_notes": "Delivery to Pune, Maharashtra. Requires individual packing with test certificate.", "enquiry_type": "complete", "missing_fields": ["drilling_std"], "confidence": 1.0}	[]	1	Parser: flow_type=complete, confidence=1.00, products=2, missing=['drilling_std']	["drilling_std"]	\N	complete	\N	2026-04-17 08:20:18.100036+00	2026-04-17 08:23:54.094654+00	\N	\N
84d9945a-b860-4096-b5e4-986182c2d747	parth_valves	Subject: RFQ – Wafer Type Butterfly Valve, PN16 (DN100 & DN150)\\n\\nDear Marketing Team,\\nWe need your quotation for the following butterfly valves for a water line application.\\n\\nProduct: Butterfly Valve – Wafer Type\\nPressure Rating: PN16\\nEnd Connection: Wafer\\nBody Material: Ductile Iron\\nDisc (MOC Variant): SS316\\nSeat Material: EPDM\\nStem Material: SS410\\nOperator Config: Lever (manual)\\nPaint Finish: Blue epoxy coated\\n\\nSizes & quantity:\\nDN100 (4\\") – Qty 4 Nos\\nDN150 (6\\") – Qty 2 Nos\\nDelivery: Pune, Maharashtra\\nPacking: Individual packing with test certificate\\n\\nWarm regards,\\nSneha Kulkarni\\nsnehakulkarni@gmail.com\\nShena Steel Works Pvt. Ltd.\\n9812012345	email	pending_human_review	0d512991-2f23-422d-b4ed-04bfc81ea597	\N	{"client_name": "Sneha Kulkarni", "client_company": "Shena Steel Works Pvt. Ltd.", "client_email": "snehakulkarni@gmail.com", "client_phone": "9812012345", "products_requested": [{"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN100 (4\\")", "quantity": 4, "size_inch": "4\\"", "size_mm": "DN100", "pressure_rating": "PN16", "material": "Body: Ductile Iron, Disc: SS316, Seat: EPDM, Stem: SS410", "application": "water line", "cascade_filters": {"sub_category": "Wafer Type", "product": "Butterfly Valve", "design": null, "body_material": "Ductile Iron", "seat_material": "EPDM", "stem_material": "SS410", "pressure_rating": "PN16", "end_connection": "Wafer", "drilling_std": null, "paint_finish": "Blue epoxy coated", "operator_config": "Lever", "disc_moc_variant": "SS316", "size": "DN100"}}, {"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN150 (6\\")", "quantity": 2, "size_inch": "6\\"", "size_mm": "DN150", "pressure_rating": "PN16", "material": "Body: Ductile Iron, Disc: SS316, Seat: EPDM, Stem: SS410", "application": "water line", "cascade_filters": {"sub_category": "Wafer Type", "product": "Butterfly Valve", "design": null, "body_material": "Ductile Iron", "seat_material": "EPDM", "stem_material": "SS410", "pressure_rating": "PN16", "end_connection": "Wafer", "drilling_std": null, "paint_finish": "Blue epoxy coated", "operator_config": "Lever", "disc_moc_variant": "SS316", "size": "DN150"}}], "additional_notes": "Delivery to Pune, Maharashtra. Requires individual packing with test certificate.", "enquiry_type": "complete", "missing_fields": ["drilling_std"], "confidence": 1.0}	[]	1	Parser: flow_type=complete, confidence=1.00, products=2, missing=['drilling_std']\nMatcher: used DB cascade\nEmailComposer: email composed by AI	[]	\N	not_found	\N	2026-04-17 08:24:51.111571+00	2026-04-17 08:25:43.860064+00	\N	\N
cb1867c9-d5de-4240-b768-eb35c7f339f2	parth_valves	Subject: RFQ – Wafer Type Butterfly Valve, PN16 (DN100 & DN150)\n\nBody: Dear Marketing Team,\nWe need your quotation for the following butterfly valves for a water line application.\n\nProduct: Butterfly Valve – Wafer Type\nPressure Rating: PN16\nEnd Connection: Wafer\nBody Material: Ductile Iron\nDisc (MOC Variant): SS316\nSeat Material: EPDM\nStem Material: SS410\nOperator Config: Lever (manual)\nPaint Finish: Blue epoxy coated\n\nSizes & quantity:\n\nDN100 (4”) – Qty 4 Nos\nDN150 (6”) – Qty 2 Nos\nDelivery: Pune, Maharashtra\nPacking: Individual packing with test certificate\nPlease mention make/model, unit rate, GST, lead time, and warranty.\n\nWarm regards,\nSneha Kulkarni\nsnehakulkarni@gmail.com\nShena Steel Works Pvt. Ltd.\n9812012345	email	pending_human_review	e390847d-9321-4237-9d7a-27582196610e	output/erp_exports/EnquiryList_CB1867C9_20260417.xlsx	{"client_name": "Sneha Kulkarni", "client_company": "Shena Steel Works Pvt. Ltd.", "client_email": "snehakulkarni@gmail.com", "client_phone": "9812012345", "products_requested": [{"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN100", "quantity": 4, "size_inch": "4\\"", "size_mm": "DN100", "pressure_rating": "PN16", "material": "Body: Ductile Iron, Disc: SS316, Seat: EPDM, Stem: SS410", "application": "water line", "cascade_filters": {"sub_category": "wafer_type", "product": "butterfly_valve", "design": "wafer", "body_material": "ductile_iron", "disc_moc_variant": "ss316", "seat_material": "epdm", "stem_material": "ss410", "pressure_rating": "pn16", "end_connection": "wafer", "operator_config": "lever", "paint_finish": "blue_epoxy", "size": "DN100"}}, {"category": "butterfly_valve", "product_description": "Butterfly Valve \\u2013 Wafer Type, DN150", "quantity": 2, "size_inch": "6\\"", "size_mm": "DN150", "pressure_rating": "PN16", "material": "Body: Ductile Iron, Disc: SS316, Seat: EPDM, Stem: SS410", "application": "water line", "cascade_filters": {"sub_category": "wafer_type", "product": "butterfly_valve", "design": "wafer", "body_material": "ductile_iron", "disc_moc_variant": "ss316", "seat_material": "epdm", "stem_material": "ss410", "pressure_rating": "pn16", "end_connection": "wafer", "operator_config": "lever", "paint_finish": "blue_epoxy", "size": "DN150"}}], "additional_notes": "Delivery to Pune, Maharashtra. Requires individual packing with test certificate. Customer wants make/model, unit rate, GST, lead time, and warranty in the quotation.", "enquiry_type": "complete", "missing_fields": [], "confidence": 1.0}	[]	1	Parser: flow_type=complete, confidence=1.00, products=2, missing=[]\nMatcher: used DB cascade\nMissingFields: generated clarification for []\nEmailComposer: email composed by AI	[]	\N	not_found	\N	2026-04-17 08:29:29.116441+00	2026-04-17 08:30:21.68627+00	\N	\N
ca215ae8-6d17-44cd-b935-b8a220e85c79	parth_valves	From: Prathamesh Chavan <sales@parthvalve.com>\nDate: Fri, 17 Apr 2026 09:43:24 +0000\nSubject: RE: RFQ- Pneumatically Actuated Ball Valve with Accessories (Limit\r\n Switch & Solenoid Valve)\n\nOn Mon, Apr 6, 2026 at 3:45 PM Gajendra Khawale <gajendra.khawale@procmart.com<mailto:gajendra.khawale@procmart.com>> wrote:\r\nHello Sir,\r\n\r\nWe have a requirement from one of our clients for resale.\r\n\r\nPlease share your quotation with technical and commercial details. Also include the HSN code, delivery charges, stock availability, and delivery time\r\n\r\nRequirement-\r\n\r\n\r\nItem 1:\r\n·        Size: DN 20\r\n·        Body: WCB\r\n·        Trim: SS316\r\n·        Solid Ball\r\n·        PTFE Seat & Seal\r\n·        2 Pc Design, Full Bore\r\n·        Flanged, Class 150\r\n·        Pneumatic Actuator : EBRO EB 4.1 SYD (Double Acting) With Limit Switch: SBU-M203-K214-M01 Solenoid Valve: HERION 8010777.3033, 24VDC (Single Solenoid Valve with Coil)\r\n·        Quantity: 5 Nos\r\n\r\n\r\nItem 2:\r\n·        Size: DN 80\r\n·        Body: WCB\r\n·        Trim: SS316\r\n·        Solid Ball\r\n·        PTFE Seat & Seal\r\n·        2 Pc Design, Full Bore\r\n·        Flanged, Class 150\r\n·        Pneumatic Actuator: EB 6.1 SYD (Double Acting) With Limit Switch: SBU-M203-K214-M01 Solenoid Valve: HERION 8010777.3033, 24VDC (Single Solenoid Valve with Coil)\r\n·        Quantity: 4 Nos\r\n\r\n\r\n\r\n Please share the Quotation at the earliest.\r\n--\r\n-- Best Regards,\r\n\r\n[https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpVqwVWXi5y52LhRVT1VcpSzp8obNROSkgneCpjjY2fFIoX40y&s]\r\n\r\nGajendra Khawale\r\n\r\nProcurement Executive-Operations\r\n\r\nProcMart\r\n[https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/phone-icon-2x.png]\r\n7020126044\r\n[https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/email-icon-2x.png]\r\ngajendra.khawale@procmart.com<mailto:vishal.chitbone@procmart.com>\r\n[https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/link-icon-2x.png]\r\nwww.procmart.com<http://ec2-34-221-130-80.us-west-2.compute.amazonaws.com/x/d?c=28957687&l=d77cf391-8fcd-45c6-805a-df7564b4ce24&r=26eb6a74-a0aa-43bc-9b0c-f1b4abb39be8>\r\n\r\nINSTANT PROCUREMENT SERVICES PVT LTD\r\nBuilding No- A-201/202\r\n34, Aundh Road, Bhau Patil Marg,\r\nPune-411020, Maharashtra. India	email_sync	pending_client_verification	\N	\N	{"client_name": "Gajendra Khawale", "client_company": "ProcMart", "client_email": "gajendra.khawale@procmart.com", "client_phone": "7020126044", "products_requested": [{"category": "ball_valve", "product_description": "Size: DN 20, Body: WCB, Trim: SS316, Solid Ball, PTFE Seat & Seal, 2 Pc Design, Full Bore, Flanged, Class 150, Pneumatic Actuator : EBRO EB 4.1 SYD (Double Acting) With Limit Switch: SBU-M203-K214-M01 Solenoid Valve: HERION 8010777.3033, 24VDC (Single Solenoid Valve with Coil)", "quantity": 5, "size_inch": "3/4\\"", "size_mm": 20, "pressure_rating": "Class 150", "material": "Body: WCB, Trim: SS316, Seat: PTFE", "application": "Resale", "cascade_filters": {"size": "DN20", "sub_category": "Flanged Ball Valve", "product": "2 Pc Design Ball Valve", "design": "Full Bore", "body_material": "WCB", "seat_material": "PTFE", "stem_material": "SS316", "moc_variant": "SS316", "pressure_rating": "Class 150", "end_connection": "Flanged End", "operator_config": "Pneumatic Actuator (Double Acting)"}}, {"category": "ball_valve", "product_description": "Size: DN 80, Body: WCB, Trim: SS316, Solid Ball, PTFE Seat & Seal, 2 Pc Design, Full Bore, Flanged, Class 150, Pneumatic Actuator: EB 6.1 SYD (Double Acting) With Limit Switch: SBU-M203-K214-M01 Solenoid Valve: HERION 8010777.3033, 24VDC (Single Solenoid Valve with Coil)", "quantity": 4, "size_inch": "3\\"", "size_mm": 80, "pressure_rating": "Class 150", "material": "Body: WCB, Trim: SS316, Seat: PTFE", "application": "Resale", "cascade_filters": {"size": "DN80", "sub_category": "Flanged Ball Valve", "product": "2 Pc Design Ball Valve", "design": "Full Bore", "body_material": "WCB", "seat_material": "PTFE", "stem_material": "SS316", "moc_variant": "SS316", "pressure_rating": "Class 150", "end_connection": "Flanged End", "operator_config": "Pneumatic Actuator (Double Acting)"}}], "additional_notes": "Client requires quotation with technical and commercial details, HSN code, delivery charges, stock availability, and delivery time. The requirement is for resale.", "enquiry_type": "complete", "missing_fields": ["drilling_std"], "confidence": 0.98}	\N	0.98	Parser: flow_type=complete, confidence=0.98, products=2, missing=['drilling_std']	["drilling_std"]	\N	complete	\N	2026-04-17 09:44:28.83188+00	2026-04-17 09:44:52.467928+00	\N	\N
79a2a0cb-794e-4c9b-81f4-b87e89b97890	parth_valves	Test enquiry	email	received	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-20 12:12:19.358869+00	2026-04-20 12:12:19.37619+00	2026-04-20 12:12:19.374417+00	\N
8826bcaa-59b9-4561-90f9-8ae29c2e1599	parth_valves	From: Jack Shukla <jackshukla8130@gmail.com>\nDate: Fri, 17 Apr 2026 15:25:39 +0530\nSubject: FW: RFQ- Pneumatically Actuated Ball Valve with Accessories (Limit Switch & Solenoid Valve)\n\nOn Mon, Apr 6, 2026 at 3:45 PM Gajendra Khawale <gajendra.khawale@procmart.com> wrote:\n\nWe have a requirement from one of our clients for resale.\nRequirement-\nItem 1: Size: DN 20 Body: WCB Trim: SS316 Solid Ball PTFE Seat & Seal 2 Pc Design, Full Bore Flanged, Class 150 Pneumatic Actuator: EBRO EB 4.1 SYD Quantity: 5 Nos\nItem 2: Size: DN 80 Body: WCB Trim: SS316 Solid Ball PTFE Seat & Seal 2 Pc Design, Full Bore Flanged, Class 150 Pneumatic Actuator: EB 6.1 SYD Quantity: 4 Nos\n	email	pending_client_verification	\N	\N	{"client_name": "Jack Shukla", "client_company": "ProcMart", "client_email": "jackshukla8130@gmail.com", "client_phone": null, "products_requested": [{"category": "ball_valve", "product_description": "Size: DN 20 Body: WCB Trim: SS316 Solid Ball PTFE Seat & Seal 2 Pc Design, Full Bore Flanged, Class 150 Pneumatic Actuator: EBRO EB 4.1 SYD", "quantity": 5, "size_inch": "3/4\\"", "size_mm": 20, "pressure_rating": "Class 150", "material": "Body: WCB, Trim: SS316", "application": "Resale", "cascade_filters": {"size": "DN20", "sub_category": "Flanged End", "product": "2 PC Design Ball Valve", "design": "Full Bore", "body_material": "WCB", "moc_variant": "SS316", "stem_material": "SS316", "seat_material": "PTFE", "pressure_rating": "Class 150", "end_connection": "Flanged", "operator_config": "Pneumatic Actuator"}}, {"category": "ball_valve", "product_description": "Size: DN 80 Body: WCB Trim: SS316 Solid Ball PTFE Seat & Seal 2 Pc Design, Full Bore Flanged, Class 150 Pneumatic Actuator: EB 6.1 SYD", "quantity": 4, "size_inch": "3\\"", "size_mm": 80, "pressure_rating": "Class 150", "material": "Body: WCB, Trim: SS316", "application": "Resale", "cascade_filters": {"size": "DN80", "sub_category": "Flanged End", "product": "2 PC Design Ball Valve", "design": "Full Bore", "body_material": "WCB", "moc_variant": "SS316", "stem_material": "SS316", "seat_material": "PTFE", "pressure_rating": "Class 150", "end_connection": "Flanged", "operator_config": "Pneumatic Actuator"}}], "additional_notes": "Request is for resale via ProcMart. Subject line mentions accessories are required: Limit Switch & Solenoid Valve. Specific actuator models requested: EBRO EB 4.1 SYD for DN20 and EB 6.1 SYD for DN80.", "enquiry_type": "complete", "missing_fields": ["client_phone", "drilling_std", "paint_finish"], "confidence": 1.0}	\N	1	Parser: flow_type=complete, confidence=1.00, products=2, missing=['client_phone', 'drilling_std', 'paint_finish']	["client_phone", "drilling_std", "paint_finish"]	\N	complete	\N	2026-04-17 10:02:39.409216+00	2026-04-17 10:03:04.377942+00	\N	\N
1f9bcbbd-51cb-4ca7-8dd4-42157ac3544f	parth_valves	Subject: RFQ – Ball valves\n\nPlease quote 3-piece Ball Valve with handle.\nSize 3/4" Qty 6\n	email	pending_client_verification	\N	\N	{"client_name": null, "client_company": null, "client_email": null, "client_phone": null, "products_requested": [{"category": "ball_valve", "product_description": "3-piece Ball Valve with handle", "quantity": 6, "size_inch": "3/4\\"", "size_mm": null, "pressure_rating": null, "material": null, "application": null, "cascade_filters": {"sub_category": "3 Piece Design", "design": "3 Piece", "operator_config": "Lever Operated", "size": "3/4\\""}}], "additional_notes": null, "enquiry_type": "incomplete", "missing_fields": ["body_material", "seat_material", "pressure_rating", "end_connection", "client_name", "client_company", "client_email"], "confidence": 0.95}	\N	0.95	Parser: flow_type=incomplete, confidence=0.95, products=1, missing=['body_material', 'seat_material', 'pressure_rating', 'end_connection', 'client_name', 'client_company', 'client_email']	["body_material", "seat_material", "pressure_rating", "end_connection", "client_name", "client_company", "client_email"]	\N	incomplete	\N	2026-04-17 10:12:58.637129+00	2026-04-17 10:13:14.985308+00	\N	\N
\.


--
-- Data for Name: processed_emails; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.processed_emails (id, message_id, sender_email, sender_name, subject, received_at, enquiry_id, was_processed, filter_reason, created_at) FROM stdin;
96dfbaf0-1134-41d1-a043-951d3ceaeb9b	<0100019d9a934d00-26d3f909-2147-47a4-86f9-e307ae082ec2-000000@email.amazonses.com>	noreply@redditmail.com	Reddit	"Gemma 4 31b 3D geometry"	2026-04-17 08:33:58+00	\N	f	auto_sender	2026-04-17 08:34:28.893174+00
ebc9f6d9-d3c7-4f8a-bd4d-195b44f80473	<PNYP287MB5702B1616B96E83777F455BDCA202@PNYP287MB5702.INDP287.PROD.OUTLOOK.COM>	sales@parthvalve.com	Prathamesh Chavan	FW: RFQ- Pneumatically Actuated Ball Valve with Accessories (Limit\r\n Switch & Solenoid Valve)	2026-04-17 09:13:25+00	2889b0c6-2733-4971-8033-b9040332da28	t	\N	2026-04-17 09:14:28.644433+00
ab8db49b-d323-49d6-ae20-c7e21f0baab4	<PNYP287MB5702F5EFCA0214F75B5B2DC8CA202@PNYP287MB5702.INDP287.PROD.OUTLOOK.COM>	sales@parthvalve.com	Prathamesh Chavan	RE: RFQ- Pneumatically Actuated Ball Valve with Accessories (Limit\r\n Switch & Solenoid Valve)	2026-04-17 09:43:24+00	ca215ae8-6d17-44cd-b935-b8a220e85c79	t	\N	2026-04-17 09:44:28.756136+00
b2907728-da89-433b-9c33-4697a8d6411e	<tNTztV2ORO2EUqcnbWzK6w@geopod-ismtpd-115>	noreply@discord.com	Discord	smakosh mentioned you in LLMGateway	2026-04-17 15:34:05+00	\N	f	auto_sender	2026-04-17 15:35:56.852718+00
17fffeb1-df31-4436-9dde-2df00b2054a5	<1776697907438.dd5d2f54-66fb-49c8-ac3e-339e18859158@bf02x.hubspotemail.net>	noreply@humansignal.com	HumanSignal	The 5 Metrics that Actually Move AI into Production 	2026-04-20 15:11:47+00	\N	f	auto_sender	2026-04-20 15:12:45.184417+00
efb1759b-81f6-457e-8020-e8dcaaec8c12	<0100019db0bd7bdb-940efeb8-8d64-4cfa-8b7a-a4ccb8d1cfec-000000@email.amazonses.com>	noreply@redditmail.com	Reddit	"Kimi K2.6"	2026-04-21 15:51:41+00	\N	f	auto_sender	2026-04-21 15:53:24.097897+00
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quotations (id, enquiry_id, quote_number, client_name, client_company, client_email, client_phone, line_items, subtotal, gst_rate, gst_amount, pf_rate, pf_amount, freight_note, total_amount, validity_days, status, pdf_path, notes, created_at, updated_at) FROM stdin;
35057ad2-3312-454a-855a-4a1caafffe7a	70f4ae07-405c-4274-b7c4-750665c98524	QT-20260417-1C57FCF9	AKASH		akashpan225622@gmail.com	+919770881484	[{"product_id": "sight_glass:d9af5793-6ddc-4c0e-aba2-1244167cc75d", "description": "Double Window Sight Glass", "details": "Material: CF8M / PTFE / NA / CF8M, Size: 40mm, End Connection: Screwed / Socket Weld End, Pressure Rating: Class 150", "quantity": 4, "unit": "piece", "unit_price": 6001.0, "line_total": 24004.0}]	24004	18	4320.72	3	720.12	Extra at actual	29044.84	15	approved	/app/output/pdfs/QT-20260417-1C57FCF9.pdf	Customer company name was not provided.\nPlease confirm the quoted specifications (CF8M Body, PTFE Seat, Class 150, Screwed / Socket Weld End) meet your requirements.	2026-04-17 06:45:31.551858+00	2026-04-17 06:45:31.611234+00
a79a1cc6-05f7-4459-925e-c0b7d55c22b4	2d0eed5d-f592-4cdb-8764-c95d1aa45103	QT-20260417-07F8EAE6	AKASH		akashpan225622@gmail.com	+(91)-9770881484	[{"product_id": "sight_glass:11a9b46f-75f3-41f4-861b-d1052d161c77", "description": "Full View Sight Glass\\nMaterial: CF8 / PTFE / NA / CF8\\nSize: 20.0 mm", "quantity": 4, "unit": "piece", "unit_price": 2363.0, "line_total": 9452.0}]	9452	18	1701.36	3	283.56	Extra at actual	11436.92	15	approved	/app/output/pdfs/QT-20260417-07F8EAE6.pdf	Customer company name was not provided.	2026-04-17 06:51:26.941197+00	2026-04-17 06:51:26.992966+00
ce6478d4-8ed4-4129-af70-87b7d2184095	4ff6598e-8ab5-441a-8142-b40445ad41cf	QT-20260417-58475F35	AKASH		akashpan225622@gmail.com	+(91)-9770881484	[{"product_id": "sight_glass:93e12545-1afc-49a8-9633-9ee895b7f79f", "description": "Double Window Sight Glass\\nSize: 80mm (DN80)\\nBody: WCB\\nSeat: PTFE\\nEnd Connection: Flanged End\\nPressure Rating: Class 150", "quantity": 4, "unit": "piece", "unit_price": 15147.0, "line_total": 60588.0}]	60588	18	10905.84	3	1817.64	Extra at actual	73311.48	15	approved	/app/output/pdfs/QT-20260417-58475F35.pdf	Customer company name was not provided.	2026-04-17 07:41:38.738324+00	2026-04-17 07:41:39.090416+00
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at, device_info) FROM stdin;
729e6a91-025c-4a1f-a06c-27a23b22abdb	e77cf4e8-0684-44f8-8b3d-282ec43355c7	b54daa82f85b465674733f155684a77ac27ff0a97f75094f997a626da9574149	2026-05-17 05:24:40.123575+00	2026-04-17 05:24:39.269447+00	\N	curl/8.7.1
b6290cb2-042f-4c23-84c3-358a3fa4294f	e77cf4e8-0684-44f8-8b3d-282ec43355c7	e1cc7fca9a70cd96c9a4d7e3f970bade4aeab537874456c550e250725242811b	2026-05-17 05:28:10.145541+00	2026-04-17 05:28:09.795164+00	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
1fd3e099-2ab8-4e47-a25d-091611315fd1	e77cf4e8-0684-44f8-8b3d-282ec43355c7	c1f7fb13260749ed0def9051e03802e2db2f02b31e6b168776a48c19e663d0ed	2026-05-17 05:28:32.321128+00	2026-04-17 05:28:32.047962+00	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
ed1e7d92-5cf6-43e3-a06c-1f4468df8ca7	e77cf4e8-0684-44f8-8b3d-282ec43355c7	9e842859b897d0b697dfc51c75af7d845d8ea643e463ecb277c0b517532d7695	2026-05-17 05:57:20.752831+00	2026-04-17 05:57:20.445915+00	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
8e268f19-0440-4f2f-b1f0-bc342115ad9d	e77cf4e8-0684-44f8-8b3d-282ec43355c7	9bb2ad3b1ed3a2a24c1dd5cb5a5a6b9b94ec069a459662eee0ea43a8fc92e8bf	2026-05-17 06:36:45.642086+00	2026-04-17 06:36:45.356548+00	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
ff435de9-fa32-4426-951d-cbbb23a84426	e77cf4e8-0684-44f8-8b3d-282ec43355c7	ba905fbaa988f82810cb69b9998f830cd9c3eac908bf91e92fd8c6c3d27726a5	2026-05-17 06:44:13.953978+00	2026-04-17 06:44:13.605113+00	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
8e7723c4-6b97-4a77-9608-97fc8bedc7ce	e77cf4e8-0684-44f8-8b3d-282ec43355c7	63c78f0fdaaae09af88decb47d4b8c9b1c98c543bd95bfa5e766a02abfd8cd39	2026-05-17 07:35:43.355685+00	2026-04-17 07:35:43.087723+00	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
f0b36ed0-aec0-487a-8735-b7785317b7eb	e77cf4e8-0684-44f8-8b3d-282ec43355c7	f5bb54b709debb49005e8d4756e805f4f0ca82959444c71f7a6f1f33d7d4f181	2026-05-17 07:53:14.870514+00	2026-04-17 07:53:14.594729+00	\N	curl/8.7.1
6a998228-e1c3-49f1-9b89-ba7f8e7f0312	e77cf4e8-0684-44f8-8b3d-282ec43355c7	f45bafe1c110de2cebd593c48c9ee91556db11188d5706b682f52e0fb962678b	2026-05-17 07:53:33.390228+00	2026-04-17 07:53:33.084349+00	\N	curl/8.7.1
72b2a554-ee4e-4af5-a3bc-0c4ad44f87fc	e77cf4e8-0684-44f8-8b3d-282ec43355c7	9b37b2d6c97c56356d37209668e22e3e397494a90ca1c3f1cc9a6fdf32fcb409	2026-05-17 07:56:04.664793+00	2026-04-17 07:56:04.385497+00	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
78e889c6-370d-43d6-b2a7-0e055fc4ab24	e77cf4e8-0684-44f8-8b3d-282ec43355c7	95b69404bdb7fe15430d7018a6354e7c5d49ebd380d2cc0887dd699595b8f957	2026-05-17 07:59:50.08185+00	2026-04-17 07:59:49.747817+00	\N	curl/8.7.1
d43f12a3-6be0-4c36-89dc-786a57f6e3f3	e77cf4e8-0684-44f8-8b3d-282ec43355c7	11c512b5277041b545456b242f211393bb55e0d17c56d9e3a8e81a422fa8c85f	2026-05-17 08:00:55.895828+00	2026-04-17 08:00:55.598732+00	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
dfa72848-91e7-4e37-82f4-ef4d25adddaf	e77cf4e8-0684-44f8-8b3d-282ec43355c7	67617c64cc22044751ef70164183f975887651d183fd7e047c6f5e4c9054cdb2	2026-05-17 08:20:18.052548+00	2026-04-17 08:20:17.782945+00	\N	curl/8.7.1
2bd6f3d7-59c9-4fc8-a892-0bb8d31e627a	e77cf4e8-0684-44f8-8b3d-282ec43355c7	5422c89b50b522f3ff46f4046984061830ed096723e82d371beb89c553726435	2026-05-17 08:21:00.177214+00	2026-04-17 08:20:59.87402+00	\N	curl/8.7.1
f05a136a-fd1d-415b-a67f-ab5a6797d8c4	e77cf4e8-0684-44f8-8b3d-282ec43355c7	d4bb2b9ce89b40c48dd90de8e434fd34e5034d7fb1aafafabe61b3f4c4e0fe1c	2026-05-17 08:23:33.229676+00	2026-04-17 08:23:32.963681+00	\N	curl/8.7.1
98ff5c3d-a393-4c61-9032-95ce3b077d16	e77cf4e8-0684-44f8-8b3d-282ec43355c7	9abd7fd4ff489a4f05adb31fabae0117daf5cd579de22c66bb7106912d2d47bd	2026-05-17 08:24:51.044245+00	2026-04-17 08:24:50.775401+00	\N	curl/8.7.1
f4a205b9-bc55-41bd-9b93-7bf287e85e60	e77cf4e8-0684-44f8-8b3d-282ec43355c7	e3104dedecfbfb2788a144d605fe8151873dd7c84a17bf5865d6b34d039ed35a	2026-05-17 10:02:39.231325+00	2026-04-17 10:02:37.658525+00	\N	curl/8.7.1
b52b63aa-c02e-4ef2-a0f7-95a84f4d315b	e77cf4e8-0684-44f8-8b3d-282ec43355c7	527b36e7d66bf72f53cb88845d9c8bef79fca3a9d08724b958b89898a7cb149d	2026-05-17 10:12:58.309482+00	2026-04-17 10:12:57.736442+00	\N	curl/8.7.1
2625cea6-82fb-4e85-afd5-381d237e681b	e77cf4e8-0684-44f8-8b3d-282ec43355c7	c7a44393755bc1cdb450c05c229be3b78ce9f79c0fd4f47408b3dc3c8d22f6b4	2026-05-20 12:01:33.379137+00	2026-04-20 12:01:33.100867+00	\N	curl/8.7.1
eb91ba84-9480-4f96-a350-7e6dbebe6e52	e77cf4e8-0684-44f8-8b3d-282ec43355c7	4154ea1edffe7680cd826b923f1fe5f8793c376b9d52c2cbc72c0740dbf1bf53	2026-05-20 12:01:38.791648+00	2026-04-20 12:01:38.523755+00	\N	curl/8.7.1
\.


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_permissions (id, user_id, permission, granted_by, granted_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, full_name, hashed_password, tier, job_title, is_active, is_first_login, created_by, last_login_at, last_login_ip, reset_token, reset_token_expires, created_at, updated_at) FROM stdin;
e77cf4e8-0684-44f8-8b3d-282ec43355c7	admin@parthvalve.com	Super Admin	$2b$12$kaNsfdeuANaLt3EyKlMMr.ttapZTZm3wXxUbG3fpamrB9a1aFWyem	superadmin	Super Administrator	t	f	\N	2026-04-20 12:01:38.791955+00	\N	\N	\N	2026-04-17 05:22:33.970626+00	2026-04-20 12:01:38.523755+00
\.


--
-- Name: email_sync_state_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.email_sync_state_id_seq', 1, false);


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

\unrestrict 2H0qsggSdTFQIitqrjonncIwU8wyElfGbaS8YMpdHd0vy79AxTpvu9nzszPuCHW

