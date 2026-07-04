{{- define "photo-critique.labels" -}}
app.kubernetes.io/name: {{ include "photo-critique.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "photo-critique.name" -}}
{{ .Chart.Name }}
{{- end }}

{{- define "photo-critique.fullname" -}}
{{ include "photo-critique.name" . }}-{{ .Release.Name }}
{{- end }}

{{- define "photo-critique.selectorLabels" -}}
app.kubernetes.io/name: {{ include "photo-critique.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}